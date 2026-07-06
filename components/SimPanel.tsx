export default function SimPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/40" onClick={onClose}>
      <div className="w-full rounded-t-2xl bg-white p-4" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm text-ink-soft">Sim panel (coming next)</p>
      </div>
    </div>
  );
}
