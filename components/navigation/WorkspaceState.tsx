export default function WorkspaceState({ loading, error, warnings = [], refresh }: { loading: boolean; error: string; warnings?: string[]; refresh: () => void }) {
  return <>
    {loading && <p role="status" className="workspace-message">جارٍ تحميل البيانات…</p>}
    {error && <div role="alert" className="workspace-message workspace-warning">{error} <button type="button" onClick={refresh}>إعادة المحاولة</button></div>}
    {!!warnings.length && <div role="alert" className="workspace-message workspace-warning"><p>بعض البيانات غير مكتملة:</p><ul>{warnings.map(warning => <li key={warning}>{warning}</li>)}</ul><button type="button" onClick={refresh}>إعادة المحاولة</button></div>}
  </>;
}
