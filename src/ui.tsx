import { useEffect, useId, useState } from 'react';

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  type?: string;
  inputMode?: 'text' | 'email' | 'tel' | 'url';
  multiline?: boolean;
}

export function TextField({ label, value, onChange, autoComplete, type = 'text', inputMode, multiline }: TextFieldProps) {
  const id = useId();
  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      {multiline ? (
        <textarea id={id} value={value} rows={3} autoComplete={autoComplete} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input
          id={id}
          value={value}
          type={type}
          inputMode={inputMode}
          autoComplete={autoComplete}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </label>
  );
}

export function InstallTip() {
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true);
  const [open, setOpen] = useState(() => !standalone && localStorage.getItem('card-scanner-install-tip') !== 'hidden');
  if (!open) return null;
  return (
    <aside className="tip">
      <p>
        <strong>Add this to your iPhone.</strong> In Safari, tap Share, then Add to Home Screen, and leave Open as Web App on.
      </p>
      <button
        type="button"
        onClick={() => {
          localStorage.setItem('card-scanner-install-tip', 'hidden');
          setOpen(false);
        }}
      >
        Dismiss
      </button>
    </aside>
  );
}

export function Thumb({ photo, alt }: { photo: Blob; alt: string }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const next = URL.createObjectURL(photo);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [photo]);
  if (!url) return <span className="thumb thumb-empty" />;
  return <img className="thumb" src={url} alt={alt} />;
}
