import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Download } from 'lucide-react';

interface QrCodeBadgeProps {
  value: string;
  label?: string;
  subLabel?: string;
  size?: number;
  allowDownload?: boolean;
}

export function QrCodeBadge({
  value,
  label,
  subLabel,
  size = 136,
  allowDownload = false,
}: QrCodeBadgeProps) {
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(value, {
      width: size * 2,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((url) => {
        if (active) setDataUrl(url);
      })
      .catch(() => {
        if (active) setDataUrl('');
      });
    return () => {
      active = false;
    };
  }, [value, size]);

  const handleDownload = () => {
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `QR-${value.replace(/[^a-zA-Z0-9_-]/g, '_')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="inline-flex flex-col items-center gap-2 p-3 bg-white border border-slate-200 rounded-xl">
      {dataUrl ? (
        <img
          src={dataUrl}
          alt={`QR কোড: ${value}`}
          width={size}
          height={size}
          className="rounded border border-slate-100"
        />
      ) : (
        <div
          style={{ width: size, height: size }}
          className="bg-slate-100 rounded flex items-center justify-center text-[11px] text-slate-400"
        >
          QR তৈরি হচ্ছে...
        </div>
      )}
      {(label || subLabel) && (
        <div className="text-center">
          {label && <p className="text-xs font-semibold text-slate-900">{label}</p>}
          {subLabel && (
            <p className="text-[11px] text-slate-500 font-mono-tabular mt-0.5">{subLabel}</p>
          )}
        </div>
      )}
      {allowDownload && dataUrl && (
        <button
          type="button"
          onClick={handleDownload}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-blue-700 border border-blue-200 rounded-md hover:bg-blue-50 transition-colors whitespace-nowrap"
        >
          <Download className="w-3 h-3" />
          QR ডাউনলোড
        </button>
      )}
    </div>
  );
}
