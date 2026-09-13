import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function GET(req: NextRequest) {
    try {
        // 1. Authenticate Request
        const authHeader = req.headers.get('authorization');
        const secretKey = process.env.INTERNAL_SEARCH_API_KEY;

        if (!secretKey || !authHeader || authHeader !== `Bearer ${secretKey}`) {
            return NextResponse.json(
                { error: 'Unauthorized: Invalid or missing token' },
                { status: 401 }
            );
        }

        // 2. Parse & Validate Query Parameter
        const { searchParams } = new URL(req.url);
        const rawQuery = searchParams.get('q');

        if (!rawQuery || rawQuery.trim().length === 0) {
            return NextResponse.json(
                { error: 'Query parameter "q" is required' },
                { status: 400 }
            );
        }

        const query = rawQuery.trim();

        // 3. Query Database via Supabase
        const { data, error } = await supabase
            .from('properties')
            .select('*')
            .or(`property_name.ilike.%${query}%,address.ilike.%${query}%,city.ilike.%${query}%,district.ilike.%${query}%,deed_number.ilike.%${query}%`)
            .limit(30);

        if (error) {
            throw error;
        }


        // 4. Return Clean JSON Payload for Claude/MCP
        return NextResponse.json({
            query,
            count: data?.length ?? 0,
            results: data ?? [],
        });
    } catch (error: any) {
        console.error('[API Search Error]:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: error.message },
            { status: 500 }
        );
    }
}