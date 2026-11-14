import React, { useState } from 'react';

const URUNLER = [
  { id: 'u1', ad: 'Gümüş Yüzük', fiyat: '1.450 TL' },
  { id: 'u2', ad: 'Altın Kolye', fiyat: '4.200 TL' },
  { id: 'u3', ad: 'İnci Küpe', fiyat: '2.100 TL' },
];

export default function UrunVitrini({ baslik = 'Seçkin Takılar', indirimVar = true }) {
  const [seciliKategori, setSeciliKategori] = useState('tumu');
  const [detayAcik, setDetayAcik] = useState(false);

  return (
    <section className="vitrin-kapsayici" style={{ backgroundColor: '#12100e', color: '#f5efe6', padding: '40px' }}>
      <header>
        <h1>{baslik}</h1>
        <p>El işçiliğiyle hazırlanmış koleksiyonumuz.</p>
        {indirimVar && <span className="rozet">Sezon İndirimi Aktif</span>}
      </header>

      <div className="filtreler">
        <button type="button" onClick={() => setSeciliKategori('tumu')}>
          Tümü ({seciliKategori})
        </button>
        <button type="button" onClick={() => setDetayAcik((prev) => !prev)}>
          {detayAcik ? 'Detayı Gizle' : 'Detayı Göster'}
        </button>
      </div>

      <div className="urun-izgara">
        {URUNLER.map((urun) => (
          <article key={urun.id} className="urun-karti">
            <h3>{urun.ad}</h3>
            <p>{urun.fiyat}</p>
            <a href="#detay">İncele</a>
          </article>
        ))}
      </div>

      {detayAcik ? (
        <footer>
          <p>Ücretsiz kargo ve özel kutu dahildir.</p>
        </footer>
      ) : null}
    </section>
  );
}
