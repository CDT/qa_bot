export type KbFile = { path: string; title: string; mtime: string };

export function Browser({
  files,
  selected,
  onPick,
}: {
  files: KbFile[];
  selected: string | null;
  onPick: (path: string) => void;
}) {
  if (files.length === 0) {
    return <div className="empty">No files yet. Click “+ New” to create one.</div>;
  }
  return (
    <ul className="file-list">
      {files.map((f) => (
        <li key={f.path}>
          <button
            onClick={() => onPick(f.path)}
            className={selected === f.path ? "active" : ""}
          >
            <div className="file-title">{f.title}</div>
            <div className="file-path">{f.path}</div>
          </button>
        </li>
      ))}
    </ul>
  );
}
