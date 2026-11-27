import { adminClient } from '@/lib/portal/server';

function normAr(text: string): string {
  return (text || '')
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .toLowerCase()
    .trim();
}

function stripAl(word: string): string {
  return word.startsWith('ال') && word.length > 3 ? word.slice(2) : word;
}

interface ParsedIntent {
  purpose: 'rent' | 'sale' | null;
  propertyTypes: string[];
  rooms: number | null;
  budget: number | null;
  rawNorm: string;
}

function parseHatifIntent(text: string): ParsedIntent {
  const n = normAr(text);
  let purpose: 'rent' | 'sale' | null = null;
  if (/(ايجار|استئجار|مستاجر|اجار|مفروش|شهري|سنوي|يومي|استديو|استوديو)/.test(n)) {
    purpose = 'rent';
  } else if (/(شراء|بيع|تمليك|مشتري|صك|للبيع)/.test(n)) {
    purpose = 'sale';
  }

  const typeMap: Array<[RegExp, string]> = [
    [/(استديو|استوديو|ستديو)/, 'استديو'],
    [/(شقه|شقق)/, 'شقة'],
    [/(فيلا|فله|فلل)/, 'فيلا'],
    [/(دور|ادوار)/, 'دور'],
    [/(ارض|اراضي)/, 'أرض'],
    [/(عماره|عماير)/, 'عمارة'],
    [/(مكتب|مكاتب)/, 'مكتب'],
    [/(محل|محلات|معرض)/, 'محل'],
  ];
  const propertyTypes = typeMap.filter(([rx]) => rx.test(n)).map(([, label]) => label);

  let rooms: number | null = null;
  const roomMatch = n.match(/(\d{1,2})\s*(غرف|غرفه)/);
  if (roomMatch) rooms = parseInt(roomMatch[1], 10);
  else if (propertyTypes.includes('استديو')) rooms = 1;

  let budget: number | null = null;
  const millionMatch = n.match(/(\d+(?:\.\d+)?)\s*مليون/);
  const thousandMatch = n.match(/(\d+(?:\.\d+)?)\s*(الف|الاف)/);
  const plainNum = n.match(/\b(\d{4,7})\b/);
  if (millionMatch) budget = Math.round(parseFloat(millionMatch[1]) * 1_000_000);
  else if (thousandMatch) budget = Math.round(parseFloat(thousandMatch[1]) * 1_000);
  else if (plainNum && /(سعر|ميزانيه|حد|بحدود|ريال|ايجار|شراء)/.test(n)) {
    budget = parseInt(plainNum[1], 10);
  }

  return { purpose, propertyTypes, rooms, budget, rawNorm: n };
}

export async function runHatifAutoMatch(params: {
  leadId: string;
  leadName: string;
  notes: string;
}) {
  const intent = parseHatifIntent(params.notes);
  const client = adminClient();

  const { data: properties, error: propErr } = await client
    .from('properties')
    .select('id, property_name, property_type, property_kind, city, district, price, price_period, rooms, rooms_count, status, notes')
    .limit(200);

  if (propErr || !properties || properties.length === 0) return { matched: 0 };

  // Detect any city/district mentioned in the message that matches our portfolio
  const mentionedDistricts = new Set<string>();
  const mentionedCities = new Set<string>();
  for (const p of properties) {
    if (p.district) {
      const dn = stripAl(normAr(String(p.district)));
      if (dn.length >= 3 && intent.rawNorm.includes(dn)) mentionedDistricts.add(String(p.district));
    }
    if (p.city) {
      const cn = stripAl(normAr(String(p.city)));
      if (cn.length >= 3 && intent.rawNorm.includes(cn)) mentionedCities.add(String(p.city));
    }
  }

  // Skip casual messages with no real-estate intent
  const hasIntent =
    intent.purpose !== null ||
    intent.propertyTypes.length > 0 ||
    mentionedDistricts.size > 0 ||
    mentionedCities.size > 0 ||
    intent.budget !== null;
  if (!hasIntent) return { matched: 0, skipped: 'no_intent' };

  // Score each available property
  const scored = properties
    .filter((p) => !/(مباع|مؤجر|محجوز|sold|rented|archived)/i.test(String(p.status || '')))
    .map((p) => {
      let score = 0;
      const reasons: string[] = [];
      const gaps: string[] = [];

      const pText = normAr(`${p.property_name || ''} ${p.property_type || ''} ${p.property_kind || ''} ${p.notes || ''}`);
      const pDistrict = stripAl(normAr(String(p.district || '')));
      const pCity = stripAl(normAr(String(p.city || '')));
      const pRooms = Number(p.rooms ?? p.rooms_count ?? 0) || null;
      const pPrice = Number(p.price ?? 0) || null;

      // 1. Location (35 pts)
      if (mentionedDistricts.size > 0) {
        const hit = Array.from(mentionedDistricts).some((d) => stripAl(normAr(d)) === pDistrict || pText.includes(stripAl(normAr(d))));
        if (hit) { score += 35; reasons.push(`تطابق الحي (${p.district || 'مذكور'})`); }
        else gaps.push(`الحي مختلف (${p.district || 'غير محدد'})`);
      } else if (mentionedCities.size > 0) {
        const hit = Array.from(mentionedCities).some((c) => stripAl(normAr(c)) === pCity);
        if (hit) { score += 25; reasons.push(`تطابق المدينة (${p.city})`); }
      } else {
        score += 15;
      }

      // 2. Property type (30 pts)
      if (intent.propertyTypes.length > 0) {
        const hit = intent.propertyTypes.some((t) => pText.includes(stripAl(normAr(t))));
        if (hit) { score += 30; reasons.push(`تطابق نوع العقار (${intent.propertyTypes[0]})`); }
        else gaps.push(`نوع العقار مختلف (${p.property_type || 'غير محدد'})`);
      } else {
        score += 15;
      }

      // 3. Rooms (15 pts)
      if (intent.rooms && pRooms) {
        if (pRooms >= intent.rooms && pRooms <= intent.rooms + 1) {
          score += 15; reasons.push(`عدد الغرف مناسب (${pRooms})`);
        } else {
          gaps.push(`الغرف: ${pRooms} مقابل المطلوب ${intent.rooms}`);
        }
      } else {
        score += 8;
      }

      // 4. Budget (20 pts)
      if (intent.budget && pPrice) {
        const diffRatio = Math.abs(pPrice - intent.budget) / intent.budget;
        if (pPrice <= intent.budget) { score += 20; reasons.push(`السعر ضمن الميزانية (${pPrice.toLocaleString()} ر.س)`); }
        else if (diffRatio <= 0.15) { score += 14; reasons.push(`السعر قريب من الميزانية (${pPrice.toLocaleString()} ر.س)`); }
        else gaps.push(`السعر أعلى من الميزانية (${pPrice.toLocaleString()} ر.س)`);
      } else {
        score += 10;
      }

      const finalScore = Math.min(100, Math.round(score));
      const tier =
        finalScore >= 80
          ? 'qualified_ready_for_viewing'
          : finalScore >= 50
          ? 'needs_review_or_negotiation'
          : 'needs_realignment_or_alternatives';
      const labelAr =
        finalScore >= 80
          ? 'مؤهلة بقوة وجاهزة للمعاينة'
          : finalScore >= 50
          ? 'تحتاج مراجعة أو تفاوض'
          : 'تحتاج بدائل';

      return { p, score: finalScore, tier, labelAr, reasons, gaps };
    })
    .filter((x) => x.score >= 45)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  // Update empty lead fields without overwriting manual edits
  const { data: leadRow } = await client
    .from('crm_leads')
    .select('lead_type, preferred_property_type, preferred_district, preferred_city, budget_max')
    .eq('id', params.leadId)
    .maybeSingle();

  if (leadRow) {
    const patch: Record<string, unknown> = {};
    if ((!leadRow.lead_type || leadRow.lead_type === 'UNSPECIFIED') && intent.purpose) {
      patch.lead_type = intent.purpose === 'rent' ? 'TENANT' : 'BUYER';
    }
    if (!leadRow.preferred_property_type && intent.propertyTypes[0]) {
      patch.preferred_property_type = intent.propertyTypes[0];
    }
    if (!leadRow.preferred_district && mentionedDistricts.size > 0) {
      patch.preferred_district = Array.from(mentionedDistricts).join('، ');
    }
    if (!leadRow.preferred_city && mentionedCities.size > 0) {
      patch.preferred_city = Array.from(mentionedCities)[0];
    }
    if (!leadRow.budget_max && intent.budget) {
      patch.budget_max = intent.budget;
    }
    if (Object.keys(patch).length > 0) {
      await client.from('crm_leads').update(patch).eq('id', params.leadId);
    }
  }

  if (scored.length === 0) return { matched: 0 };

  // Save evaluations into opportunity_match_evaluations
  const evalRows = scored.map((m) => ({
    opportunity_source: 'crm_lead',
    opportunity_id: params.leadId,
    property_id: m.p.id,
    match_score: m.score,
    qualification_tier: m.tier,
    qualification_label_ar: m.labelAr,
    matched_reasons_json: m.reasons,
    gaps_json: m.gaps,
    needs_confirmation_json: [],
    evaluated_at: new Date().toISOString(),
  }));
  await client
    .from('opportunity_match_evaluations')
    .upsert(evalRows, { onConflict: 'opportunity_source,opportunity_id,property_id' });

  // Add a clean Arabic recommendation activity in CRM for staff
  const lines = scored.map(
    (m, i) =>
      `${i + 1}) ${m.p.property_name || 'عقار'} — ${m.p.district || m.p.city || 'غير محدد'} | السعر: ${m.p.price ? Number(m.p.price).toLocaleString() + ' ر.س' : 'غير محدد'} | التطابق: ${m.score}% (${m.reasons.join('، ') || m.labelAr})`
  );
  await client.from('crm_activities').insert({
    lead_id: params.leadId,
    lead_or_client_name: params.leadName,
    activity_type: 'NOTE',
    title: `ترشيح آلي من هاتف (${scored.length} عقارات مطابقة)`,
    notes: `تم تحليل طلب العميل تلقائياً وترشيح أفضل العقارات:\n${lines.join('\n')}`,
    due_date: new Date().toISOString().slice(0, 10),
    status: 'COMPLETED',
    created_by_name: 'محرك المطابقة الآلي · هاتف',
  });

  return { matched: scored.length, topScore: scored[0].score };
}
