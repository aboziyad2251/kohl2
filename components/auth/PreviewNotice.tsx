export default function PreviewNotice() {
    if (process.env.NEXT_PUBLIC_PORTAL_PREVIEW !== 'true')
        return null;
    return <p className="bg-amber-100 text-amber-950 border-b border-amber-300 p-3 text-center text-sm">
    بيئة تجربة مستقلة • بيانات وهمية • البريد يبقى محلياً — Isolated preview • Fake records • No external email
  </p>;
}
