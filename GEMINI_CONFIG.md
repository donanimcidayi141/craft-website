# CraftStudio - Google Gemini Yapay Zeka API ve Model Yapılandırması

> **ÖNEMLİ KURAL:** Gemini 1.5 modelleri birçok yeni hesap/bölge için kaldırılmıştır (404/desteklenmiyor).
> Bu projede ve stüdyo ajanında **Gemini 3** modelleri (`gemini-3-flash-preview`, `gemini-3.1-flash-lite-preview`) kullanılacaktır.

---

## 1. Kullanıcı API Anahtarı (Güvenlik Notu)
* **API Anahtarı:** Repoda düz metin anahtar saklanmaz. Yerel geliştirme için `.env.local` dosyasında `VITE_GEMINI_API_KEY=<YOUR_GEMINI_API_KEY>` tanımlayabilir veya Stüdyo içindeki **AI Ajanı > API Ayarları** bölümünden tarayıcıya (`localStorage`) kaydedebilirsiniz.
* **Varsayılan Model:** `gemini-3-flash-preview`

---

## 2. Desteklenen ve Erişilebilir Gemini 3 Modelleri
Aşağıdaki modeller doğrudan test edilmiş ve başarıyla yanıt vermiştir:
1. `gemini-3-flash-preview` (**Önerilen & Varsayılan** - En hızlı, akıllı ve zengin JSON üretebilen model)
2. `gemini-3.1-flash-lite-preview` (Ultra hızlı, hafif ve anlık düzeltmeler için uygun)
3. `gemini-flash-latest` (Google Flash en güncel dinamik sürümü)
4. `gemini-3.5-flash`
5. `gemini-3.1-pro-preview`

---

## 3. Çalışmayan / Kaldırılan Modeller (Kullanma!)
* ❌ `gemini-1.5-flash` / `gemini-1.5-pro` (TR ve bu anahtarda yok)
* ❌ `gemini-2.5-flash` / `gemini-2.5-pro` (Google tarafından yeni kullanıcılara kapatıldı / 404)

---

## 4. Kullanım ve Entegrasyon Yolu
* **Endpoint:** `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={API_KEY}`
* **Stüdyo Bileşeni:** `src/components/AIAgentPanel.jsx`
* **Yerel Depolama (LocalStorage):** `craft_gemini_api_key`
