import "./styles/options.css";
export default function Options({ onClose }: { readonly onClose: () => void }) {
  return (
    <div className="options-body">
      <button style={{ padding: "8px 16px" }} onClick={onClose}>
        Geri
      </button>
      <input type="text" value={1.0} />
      <div>options</div>
    </div>
  );
}
