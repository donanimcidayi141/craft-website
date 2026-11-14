import React, { useState } from 'react';

export interface HizmetOgesi {
  id: string;
  baslik: string;
  aciklama: string;
}

export interface HizmetSayfasiProps {
  markaAdi: string;
  vurgulu?: boolean;
  hizmetler: HizmetOgesi[];
}

export const HizmetSayfasi: React.FC<HizmetSayfasiProps> = ({
  markaAdi = 'Bosphorus Studio',
  vurgulu = true,
  hizmetler = [],
}) => {
  const [aktifId, setAktifId] = useState<string | null>(null);

  return (
    <main style={{ backgroundColor: '#0f172a', color: '#f8fafc', padding: '48px' }}>
      <section>
        <h1>{markaAdi} — Tasarım Sistemleri</h1>
        <p>Tip güvenli React ve TypeScript bileşen mimarisi.</p>
        {vurgulu && <strong>Kurumsal Destek Paketi</strong>}
      </section>

      <section className="hizmet-listesi">
        {hizmetler.map((hizmet: HizmetOgesi) => (
          <div key={hizmet.id} onClick={() => setAktifId(hizmet.id)}>
            <h2>{hizmet.baslik}</h2>
            <p>{hizmet.aciklama}</p>
          </div>
        ))}
        <div>
          <h2>Arayüz Danışmanlığı</h2>
          <p>Tasarımdan üretime kesintisiz bileşen kütüphaneleri.</p>
        </div>
      </section>

      <button type="button" onClick={() => setAktifId(null)}>
        Seçimi Temizle ({aktifId ?? 'Yok'})
      </button>
    </main>
  );
};

export default HizmetSayfasi;
