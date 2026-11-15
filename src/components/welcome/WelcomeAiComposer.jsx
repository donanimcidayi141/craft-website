import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Sparkles,
  Wand2,
  Layers,
  Check,
  ArrowRight,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Monitor,
  Tablet,
  Smartphone,
  Building2,
  ShoppingBag,
  Palette,
  Cpu,
  Compass,
  UtensilsCrossed,
  X,
  Zap,
  LayoutTemplate,
  GalleryHorizontal,
  Grid,
  BarChart3,
  CreditCard,
  HelpCircle,
  PanelBottom,
  MessageSquare,
  RotateCcw,
  Megaphone,
  Play,
  Image as ImageIcon,
  Users,
  Mail,
  Calendar,
  Award,
  MapPin,
  FileText,
  Briefcase,
  Clock,
  ShieldCheck,
  Sliders,
  Star,
  Calculator,
  GraduationCap,
  Newspaper,
  HeartHandshake,
  Music,
  Gamepad2,
  Car,
  HeartPulse,
  Camera,
  BedDouble,
  Dumbbell,
  Scale,
} from 'lucide-react';

const ROTATING_PLACEHOLDERS = [
  'Sitenin amacını yazın... (Örn: Mimarlık ofisi tanıtım sitesi)',
  'Sitenin amacını yazın... (Örn: El yapımı takı mağazası)',
  'Sitenin amacını yazın... (Örn: Yapay zeka uygulaması açılış sayfası)',
  'Sitenin amacını yazın... (Örn: Butik kahve dükkanı sitesi)',
];

const SECTOR_OPTIONS = [
  {
    id: 'kurumsal',
    label: 'Kurumsal',
    sub: 'Ajans & Danışmanlık',
    icon: Building2,
    defaultPalette: 'slate',
    defaultLayers: ['navbar', 'hero', 'marquee', 'service_cards', 'process_steps', 'kpi', 'testimonials', 'faq', 'contact_form', 'footer'],
    defaultHeadline: 'Markanız İçin Ölçeklenebilir Dijital Deneyimler',
    defaultPrompt:
      'Kurumsal bir tasarım ve danışmanlık ajansı için güven veren, modern tipografili tanıtım sitesi',
  },
  {
    id: 'eticaret',
    label: 'E-Ticaret',
    sub: 'Mağaza & Koleksiyon',
    icon: ShoppingBag,
    defaultPalette: 'obsidian',
    defaultLayers: ['announcement', 'navbar', 'hero', 'shop_categories', 'products', 'featured_product', 'testimonials', 'newsletter', 'faq', 'footer'],
    defaultHeadline: 'Zamansız El İşçiliği ve Seçkin Koleksiyon Vitrini',
    defaultPrompt:
      'Seçkin ürünler sunan butik bir mağaza için kategori kartlı, ürün ızgaralı ve sepet çağrılı e-ticaret sitesi',
  },
  {
    id: 'saas',
    label: 'SaaS & AI',
    sub: 'Yazılım & Ürün',
    icon: Cpu,
    defaultPalette: 'cyber',
    defaultLayers: ['navbar', 'hero', 'marquee', 'bento_showcase', 'api_code', 'integrations', 'pricing', 'comparison', 'faq', 'cta_banner', 'footer'],
    defaultHeadline: 'İş Akışlarınızı Yapay Zeka Hızıyla Otomatikleştirin',
    defaultPrompt:
      'Yeni nesil bir yazılım ürünü (SaaS) için hero vitrini, bento özellik ızgarası, entegrasyonlar ve 3 kademeli fiyatlandırma içeren açılış sitesi',
  },
  {
    id: 'portfolyo',
    label: 'Portfolyo',
    sub: 'Kreatif & Stüdyo',
    icon: Palette,
    defaultPalette: 'glass',
    defaultLayers: ['navbar', 'hero', 'portfolio_case', 'gallery', 'timeline', 'testimonials', 'contact_form', 'footer'],
    defaultHeadline: 'Görsel Hikaye Anlatımı ve Seçilmiş Tasarım İşleri',
    defaultPrompt:
      'Bağımsız bir kreatif direktör ve tasarımcı için koyu temalı, seçili projeler vitrini ve iletişim bölümü içeren portfolyo sitesi',
  },
  {
    id: 'mimarlik',
    label: 'Mimarlık',
    sub: 'Emlak & Yapı',
    icon: Compass,
    defaultPalette: 'obsidian',
    defaultLayers: ['navbar', 'hero', 'slider', 'property_listings', 'before_after', 'kpi', 'team', 'awards', 'map_location', 'footer'],
    defaultHeadline: 'Çağdaş Mimari Kurgular ve Prestijli Yaşam Alanları',
    defaultPrompt:
      'Modern konut ve mimari projeler sunan bir ofis için portföy galerisi, proje metrikleri ve randevu çağrılı prestij sitesi',
  },
  {
    id: 'restoran',
    label: 'Restoran',
    sub: 'Gastronomi & Kafe',
    icon: UtensilsCrossed,
    defaultPalette: 'ember',
    defaultLayers: ['navbar', 'hero', 'menu_board', 'gallery', 'split_story', 'booking', 'social_feed', 'map_location', 'footer'],
    defaultHeadline: 'Özel Kavrum Kahveler ve Artizan Tatlar Atölyesi',
    defaultPrompt:
      'Butik bir kafe ve gastronomi mekanı için imza menü vitrini, mekan atmosferi ve rezervasyon/iletişim bilgileri içeren site',
  },
  {
    id: 'egitim',
    label: 'Eğitim',
    sub: 'Kurs & Akademi',
    icon: GraduationCap,
    defaultPalette: 'midnight',
    defaultLayers: ['navbar', 'hero', 'kpi', 'course_catalog', 'process_steps', 'team', 'testimonials', 'pricing', 'faq', 'footer'],
    defaultHeadline: 'Geleceğinizi Uzman Eğitmenlerle Şekillendirin',
    defaultPrompt:
      'Online kurslar ve sertifika programları sunan bir akademi için program kataloğu, eğitmen kadrosu ve kayıt çağrılı eğitim sitesi',
  },
  {
    id: 'saglik',
    label: 'Sağlık',
    sub: 'Klinik & Wellness',
    icon: HeartPulse,
    defaultPalette: 'mint',
    defaultLayers: ['navbar', 'hero', 'service_cards', 'team', 'process_steps', 'testimonials', 'booking', 'faq', 'map_location', 'footer'],
    defaultHeadline: 'Sağlığınız İçin Güvenilir ve Kişisel Bakım',
    defaultPrompt:
      'Uzman kadrolu bir klinik için hizmet kartları, doktor profilleri ve online randevu formu içeren güven veren sağlık sitesi',
  },
  {
    id: 'fotograf',
    label: 'Fotoğraf',
    sub: 'Stüdyo & Çekim',
    icon: Camera,
    defaultPalette: 'mono',
    defaultLayers: ['navbar', 'hero', 'lookbook', 'gallery', 'video_showcase', 'service_cards', 'pricing', 'booking', 'social_feed', 'footer'],
    defaultHeadline: 'Anları Zamansız Karelere Dönüştürüyoruz',
    defaultPrompt:
      'Profesyonel bir fotoğraf stüdyosu için tam ekran galeri, çekim paketleri ve randevu formu içeren editoryal site',
  },
  {
    id: 'otel',
    label: 'Otel & Seyahat',
    sub: 'Konaklama & Tatil',
    icon: BedDouble,
    defaultPalette: 'sand',
    defaultLayers: ['announcement', 'navbar', 'hero', 'gallery', 'service_cards', 'reviews_wall', 'promo_countdown', 'booking', 'map_location', 'footer'],
    defaultHeadline: 'Doğanın Kalbinde Unutulmaz Bir Konaklama',
    defaultPrompt:
      'Butik bir otel için oda galerisi, olanaklar, misafir yorumları ve rezervasyon formu içeren konaklama sitesi',
  },
  {
    id: 'fitness',
    label: 'Spor & Fitness',
    sub: 'Salon & Koçluk',
    icon: Dumbbell,
    defaultPalette: 'ocean',
    defaultLayers: ['navbar', 'hero', 'impact_report', 'service_cards', 'team', 'pricing', 'before_after', 'download_app', 'footer'],
    defaultHeadline: 'Sınırlarını Zorla, Formunu Yakala',
    defaultPrompt:
      'Spor salonu ve kişisel koçluk için program kartları, dönüşüm hikayeleri, üyelik paketleri ve uygulama indirme alanı içeren enerjik site',
  },
  {
    id: 'hukuk',
    label: 'Hukuk & Finans',
    sub: 'Danışmanlık & Büro',
    icon: Scale,
    defaultPalette: 'light',
    defaultLayers: ['navbar', 'hero', 'service_cards', 'values', 'team', 'process_steps', 'awards', 'contact_form', 'footer'],
    defaultHeadline: 'Haklarınızı Güvenle Koruyan Deneyimli Kadro',
    defaultPrompt:
      'Hukuk bürosu ve finans danışmanlığı için çalışma alanları, ekip, süreç adımları ve iletişim formu içeren kurumsal güven sitesi',
  },
  {
    id: 'etkinlik',
    label: 'Etkinlik',
    sub: 'Konferans & Festival',
    icon: Calendar,
    defaultPalette: 'rose',
    defaultLayers: ['navbar', 'hero', 'promo_countdown', 'timeline', 'team', 'events', 'pricing', 'partner_cta', 'faq', 'footer'],
    defaultHeadline: 'Yılın En Etkileyici Buluşmasında Yerinizi Ayırın',
    defaultPrompt:
      'Konferans veya festival için geri sayım, program akışı, konuşmacılar, bilet paketleri ve sponsor çağrısı içeren etkinlik sitesi',
  },
  {
    id: 'blog',
    label: 'Blog & Dergi',
    sub: 'Haber & İçerik',
    icon: Newspaper,
    defaultPalette: 'sand',
    defaultLayers: ['navbar', 'hero', 'blog_grid', 'split_story', 'newsletter', 'social_feed', 'team', 'footer'],
    defaultHeadline: 'Merak Edenler İçin Derinlikli Yazılar',
    defaultPrompt:
      'Düzenli içerik üreten bir blog veya dijital dergi için öne çıkan yazılar, kategori kartları ve bülten kaydı içeren editoryal site',
  },
  {
    id: 'dernek',
    label: 'Dernek & Vakıf',
    sub: 'Sosyal Fayda',
    icon: HeartHandshake,
    defaultPalette: 'mint',
    defaultLayers: ['navbar', 'hero', 'impact_report', 'process_steps', 'values', 'team', 'events', 'partner_cta', 'contact_form', 'footer'],
    defaultHeadline: 'Birlikte Daha Güçlü Bir Yarın Kuruyoruz',
    defaultPrompt:
      'Bir dernek veya vakıf için etki rakamları, çalışma alanları, etkinlikler ve bağış/gönüllü olma çağrısı içeren sosyal fayda sitesi',
  },
  {
    id: 'muzik',
    label: 'Müzik & Sanatçı',
    sub: 'Konser & Albüm',
    icon: Music,
    defaultPalette: 'violet',
    defaultLayers: ['navbar', 'hero', 'video_showcase', 'events', 'gallery', 'social_feed', 'newsletter', 'footer'],
    defaultHeadline: 'Sahneden Sokağa, Sesin Her Yerde',
    defaultPrompt:
      'Bir müzisyen veya grup için yayınlanan işler, konser takvimi, video vitrini ve hayran bülteni içeren sahne sitesi',
  },
  {
    id: 'oyun',
    label: 'Oyun & Topluluk',
    sub: 'Gaming & E-Spor',
    icon: Gamepad2,
    defaultPalette: 'rose',
    defaultLayers: ['navbar', 'hero', 'video_showcase', 'bento_showcase', 'reviews_wall', 'download_app', 'events', 'faq', 'footer'],
    defaultHeadline: 'Yeni Dünyalar, Sınırsız Maceralar',
    defaultPrompt:
      'Bir oyun stüdyosu veya topluluk için fragman vitrini, özellik kartları, oyuncu yorumları ve indirme çağrısı içeren oyun sitesi',
  },
  {
    id: 'otomotiv',
    label: 'Otomotiv',
    sub: 'Galeri & Servis',
    icon: Car,
    defaultPalette: 'copper',
    defaultLayers: ['navbar', 'hero', 'property_listings', 'featured_product', 'comparison', 'service_cards', 'booking', 'map_location', 'footer'],
    defaultHeadline: 'Hayalinizdeki Aracı Güvenle Keşfedin',
    defaultPrompt:
      'Bir oto galeri veya servis için araç ilanları, öne çıkan model, karşılaştırma tablosu ve randevu formu içeren otomotiv sitesi',
  },
]

const PALETTE_OPTIONS = [
  {
    id: 'obsidian',
    label: 'Obsidyen Altın',
    desc: 'Lüks & Prestij',
    bg: '#0b0a09',
    surface: '#171513',
    text: '#f5f2eb',
    accent: '#d4af37',
    isLight: false,
    navPreset: 'nav-boutique-commerce',
    footerPreset: 'footer-enterprise-dark',
    promptHint: 'koyu obsidyen (#0b0a09) zemin ve sıcak altın (#d4af37) vurgulu lüks atmosfer',
  },
  {
    id: 'cyber',
    label: 'Siber Okyanus',
    desc: 'Modern Teknoloji',
    bg: '#0c101b',
    surface: '#151c2e',
    text: '#f1f5f9',
    accent: '#0d99ff',
    isLight: false,
    navPreset: 'nav-saas-split',
    footerPreset: 'footer-modern-directory',
    promptHint: 'derin gece mavisi (#0c101b) zemin ve parlak elektrik mavisi (#0d99ff) vurgulu teknoloji stili',
  },
  {
    id: 'slate',
    label: 'Kurumsal Antrasit',
    desc: 'Keskin & Net',
    bg: '#09090b',
    surface: '#18181b',
    text: '#fafafa',
    accent: '#38bdf8',
    isLight: false,
    navPreset: 'nav-corporate-dark',
    footerPreset: 'footer-enterprise-dark',
    promptHint: 'profesyonel antrasit (#09090b) zemin ve yüksek kontrastlı kurumsal tipografi',
  },
  {
    id: 'glass',
    label: 'Kreatif Mor',
    desc: 'Cam & Gradyan',
    bg: '#111018',
    surface: '#1d1b29',
    text: '#f5f3ff',
    accent: '#a855f7',
    isLight: false,
    navPreset: 'nav-floating-glass',
    footerPreset: 'footer-newsletter-cta',
    promptHint: 'yarı saydam cam katmanlar (glassmorphism), koyu mor-antrasit zemin ve canlı gradyan vurgular',
  },
  {
    id: 'emerald',
    label: 'Zümrüt Orman',
    desc: 'Doğal & Modern',
    bg: '#091410',
    surface: '#12241d',
    text: '#ecfdf5',
    accent: '#10b981',
    isLight: false,
    navPreset: 'nav-saas-split',
    footerPreset: 'footer-modern-directory',
    promptHint: 'derin zümrüt yeşili (#091410) zemin ve canlı mint/zümrüt (#10b981) vurgulu modern stil',
  },
  {
    id: 'light',
    label: 'Ferah Editoryal',
    desc: 'Açık & Minimal',
    bg: '#f8fafc',
    surface: '#ffffff',
    text: '#0f172a',
    accent: '#2563eb',
    isLight: true,
    navPreset: 'nav-minimal-centered',
    footerPreset: 'footer-minimal-editorial',
    promptHint: 'ferah açık zemin, güçlü siyah-beyaz tipografi ve editoryal boşluk dengesi',
  },
  {
    id: 'rose',
    label: 'Gül Kuvars',
    desc: 'Sıcak & Zarif',
    bg: '#14090e',
    surface: '#231218',
    text: '#fff1f4',
    accent: '#fb7185',
    isLight: false,
    navPreset: 'nav-floating-glass',
    footerPreset: 'footer-newsletter-cta',
    promptHint: 'deep rose-black background with soft rose-quartz accents',
  },
  {
    id: 'ember',
    label: 'Kızıl Kor',
    desc: 'Cesur & İştah Açıcı',
    bg: '#120a07',
    surface: '#211410',
    text: '#fff4ec',
    accent: '#f97316',
    isLight: false,
    navPreset: 'nav-boutique-commerce',
    footerPreset: 'footer-enterprise-dark',
    promptHint: 'warm charcoal background with glowing ember-orange accents',
  },
  {
    id: 'ocean',
    label: 'Okyanus Turkuaz',
    desc: 'Taze & Enerjik',
    bg: '#07131a',
    surface: '#0f222d',
    text: '#ecfeff',
    accent: '#14b8a6',
    isLight: false,
    navPreset: 'nav-saas-split',
    footerPreset: 'footer-modern-directory',
    promptHint: 'deep sea background with fresh turquoise accents',
  },
  {
    id: 'midnight',
    label: 'Gece İndigo',
    desc: 'Derin & Akademik',
    bg: '#0a0b1e',
    surface: '#14173a',
    text: '#eef2ff',
    accent: '#818cf8',
    isLight: false,
    navPreset: 'nav-corporate-dark',
    footerPreset: 'footer-modern-directory',
    promptHint: 'midnight indigo background with luminous periwinkle accents',
  },
  {
    id: 'mint',
    label: 'Ferah Nane',
    desc: 'Açık & Ferah',
    bg: '#f3faf6',
    surface: '#ffffff',
    text: '#10231b',
    accent: '#059669',
    isLight: true,
    navPreset: 'nav-minimal-centered',
    footerPreset: 'footer-minimal-editorial',
    promptHint: 'airy light mint background with calm emerald accents and dark green text',
  },
  {
    id: 'sand',
    label: 'Kum Taşı',
    desc: 'Açık & Sıcak',
    bg: '#faf6ef',
    surface: '#ffffff',
    text: '#2a2218',
    accent: '#b45309',
    isLight: true,
    navPreset: 'nav-minimal-centered',
    footerPreset: 'footer-minimal-editorial',
    promptHint: 'warm sandstone light background with terracotta-amber accents and editorial serif feel',
  },
  {
    id: 'mono',
    label: 'Saf Monokrom',
    desc: 'Siyah & Beyaz',
    bg: '#ffffff',
    surface: '#f4f4f5',
    text: '#09090b',
    accent: '#09090b',
    isLight: true,
    navPreset: 'nav-minimal-centered',
    footerPreset: 'footer-minimal-editorial',
    promptHint: 'pure black and white monochrome palette with razor-sharp typography',
  },
  {
    id: 'violet',
    label: 'Elektrik Menekşe',
    desc: 'Neon & Cesur',
    bg: '#0d0816',
    surface: '#1a1030',
    text: '#f5f0ff',
    accent: '#c026d3',
    isLight: false,
    navPreset: 'nav-floating-glass',
    footerPreset: 'footer-newsletter-cta',
    promptHint: 'dark violet background with electric magenta neon accents',
  },
  {
    id: 'crimson',
    label: 'Bordo Şarap',
    desc: 'Tutkulu & Derin',
    bg: '#13080a',
    surface: '#241014',
    text: '#fff1f2',
    accent: '#e11d48',
    isLight: false,
    navPreset: 'nav-boutique-commerce',
    footerPreset: 'footer-enterprise-dark',
    promptHint: 'deep wine-black background with rich crimson accents',
  },
  {
    id: 'copper',
    label: 'Eskitme Bakır',
    desc: 'Zanaat & Sıcak',
    bg: '#110d0a',
    surface: '#201812',
    text: '#fdf3ea',
    accent: '#d9895a',
    isLight: false,
    navPreset: 'nav-corporate-dark',
    footerPreset: 'footer-modern-directory',
    promptHint: 'dark espresso background with warm brushed-copper accents',
  },
  {
    id: 'sky',
    label: 'Gökyüzü Beyazı',
    desc: 'Açık & Güvenilir',
    bg: '#f4f9fe',
    surface: '#ffffff',
    text: '#0b1b2e',
    accent: '#0284c7',
    isLight: true,
    navPreset: 'nav-minimal-centered',
    footerPreset: 'footer-minimal-editorial',
    promptHint: 'crisp airy light-blue background with confident sky-blue accents',
  },
  {
    id: 'lavender',
    label: 'Lavanta Sisi',
    desc: 'Açık & Yaratıcı',
    bg: '#f8f5ff',
    surface: '#ffffff',
    text: '#1e1033',
    accent: '#7c3aed',
    isLight: true,
    navPreset: 'nav-floating-glass',
    footerPreset: 'footer-minimal-editorial',
    promptHint: 'soft lavender-white background with vivid violet accents',
  },
];

export const LAYER_PAGES = [
  { page: 1, title: 'Ana Yapı' },
  { page: 2, title: 'Vitrin & Medya' },
  { page: 3, title: 'Ticaret & Güven' },
  { page: 4, title: 'Kurumsal & İletişim' },
  { page: 5, title: 'Sektör Bölümleri' },
  { page: 6, title: 'Etkileşim & Detay' },
];

export const STEP_LAYERS = [
  {
    id: 'navbar',
    stepNo: '01',
    page: 1,
    label: 'Üst Menü',
    shortTag: 'Logo & Gezinme',
    icon: LayoutTemplate,
    presetKey: 'nav-corporate-dark',
    previewKind: 'nav',
    promptLabel: 'a sticky top navigation bar with logo, links and a primary call-to-action button',
    englishPrompt: 'a sticky top navigation bar with logo, links and a primary call-to-action button',
  },
  {
    id: 'announcement',
    stepNo: '02',
    page: 1,
    label: 'Duyuru Şeridi',
    shortTag: 'Kampanya Bandı',
    icon: Megaphone,
    presetKey: 'block-cta-banner',
    previewKind: 'banner',
    promptLabel: 'a slim announcement bar promoting a campaign or news',
    englishPrompt: 'a slim announcement bar promoting a campaign or news',
  },
  {
    id: 'hero',
    stepNo: '03',
    page: 1,
    label: 'Hero Vitrin',
    shortTag: 'Ana Karşılama',
    icon: Sparkles,
    presetKey: 'block-split-hero',
    previewKind: 'hero',
    promptLabel: 'an impactful hero section with headline, subtext, two buttons and a strong visual',
    englishPrompt: 'an impactful hero section with headline, subtext, two buttons and a strong visual',
  },
  {
    id: 'slider',
    stepNo: '04',
    page: 1,
    label: 'Slayt Vitrin',
    shortTag: 'Etkileşimli Karusel',
    icon: GalleryHorizontal,
    presetKey: 'slider-hero-showcase',
    previewKind: 'slider',
    promptLabel: 'an interactive carousel/slider showcasing featured work or campaigns',
    englishPrompt: 'an interactive carousel/slider showcasing featured work or campaigns',
  },
  {
    id: 'marquee',
    stepNo: '05',
    page: 1,
    label: 'Logo Şeridi',
    shortTag: 'Referans Markalar',
    icon: Star,
    presetKey: 'block-stats-kpi',
    previewKind: 'logos',
    promptLabel: 'a logo strip of trusted partner or client brands',
    englishPrompt: 'a logo strip of trusted partner or client brands',
  },
  {
    id: 'features',
    stepNo: '06',
    page: 1,
    label: 'Özellikler',
    shortTag: '3’lü Bento Izgara',
    icon: Grid,
    presetKey: 'block-features-grid',
    previewKind: 'grid3',
    promptLabel: 'a 3-column feature/service bento grid with icons',
    englishPrompt: 'a 3-column feature/service bento grid with icons',
  },
  {
    id: 'split_story',
    stepNo: '07',
    page: 1,
    label: 'Hikaye Bölümü',
    shortTag: 'Görsel + Metin',
    icon: FileText,
    presetKey: 'block-split-hero',
    previewKind: 'split',
    promptLabel: 'a split story section with image on one side and narrative text on the other',
    englishPrompt: 'a split story section with image on one side and narrative text on the other',
  },
  {
    id: 'cta_banner',
    stepNo: '08',
    page: 1,
    label: 'Çağrı Bandı',
    shortTag: 'Dönüşüm Çağrısı',
    icon: Zap,
    presetKey: 'block-cta-banner',
    previewKind: 'banner',
    promptLabel: 'a bold call-to-action banner with one clear primary button',
    englishPrompt: 'a bold call-to-action banner with one clear primary button',
  },
  {
    id: 'footer',
    stepNo: '09',
    page: 1,
    label: 'Alt Bilgi',
    shortTag: 'Bağlantılar & Telif',
    icon: PanelBottom,
    presetKey: 'footer-modern-directory',
    previewKind: 'footer',
    promptLabel: 'a multi-column footer with links, social icons and copyright',
    englishPrompt: 'a multi-column footer with links, social icons and copyright',
  },
  {
    id: 'products',
    stepNo: '10',
    page: 2,
    label: 'Ürün / İş Vitrini',
    shortTag: 'Koleksiyon Kartları',
    icon: ShoppingBag,
    presetKey: 'block-product-showcase',
    previewKind: 'products',
    promptLabel: 'a 3-column product or project collection showcase with cards',
    englishPrompt: 'a 3-column product or project collection showcase with cards',
  },
  {
    id: 'gallery',
    stepNo: '11',
    page: 2,
    label: 'Galeri',
    shortTag: 'Görsel Izgara',
    icon: ImageIcon,
    presetKey: 'block-product-showcase',
    previewKind: 'gallery',
    promptLabel: 'a masonry-style image gallery with hover zoom',
    englishPrompt: 'a masonry-style image gallery with hover zoom',
  },
  {
    id: 'video_showcase',
    stepNo: '12',
    page: 2,
    label: 'Video Vitrin',
    shortTag: 'Tanıtım Filmi',
    icon: Play,
    presetKey: 'slider-hero-showcase',
    previewKind: 'video',
    promptLabel: 'a large video showcase with a play button and caption',
    englishPrompt: 'a large video showcase with a play button and caption',
  },
  {
    id: 'bento_showcase',
    stepNo: '13',
    page: 2,
    label: 'Bento Vitrin',
    shortTag: 'Asimetrik Kartlar',
    icon: Grid,
    presetKey: 'block-features-grid',
    previewKind: 'bento',
    promptLabel: 'an asymmetric bento grid highlighting key capabilities',
    englishPrompt: 'an asymmetric bento grid highlighting key capabilities',
  },
  {
    id: 'interactive_tabs',
    stepNo: '14',
    page: 2,
    label: 'Sekmeli İçerik',
    shortTag: 'Etkileşimli Sekmeler',
    icon: Sliders,
    presetKey: 'block-features-grid',
    previewKind: 'tabs',
    promptLabel: 'a tabbed content section where each tab reveals different content',
    englishPrompt: 'a tabbed content section where each tab reveals different content',
  },
  {
    id: 'before_after',
    stepNo: '15',
    page: 2,
    label: 'Önce / Sonra',
    shortTag: 'Karşılaştırmalı Görsel',
    icon: Layers,
    presetKey: 'block-split-hero',
    previewKind: 'split',
    promptLabel: 'a before/after comparison section with a draggable divider',
    englishPrompt: 'a before/after comparison section with a draggable divider',
  },
  {
    id: 'portfolio_case',
    stepNo: '16',
    page: 2,
    label: 'Vaka Çalışması',
    shortTag: 'Proje Detayı',
    icon: Briefcase,
    presetKey: 'block-product-showcase',
    previewKind: 'products',
    promptLabel: 'a case-study section with project cover, challenge, solution and results',
    englishPrompt: 'a case-study section with project cover, challenge, solution and results',
  },
  {
    id: 'app_mockup',
    stepNo: '17',
    page: 2,
    label: 'Uygulama Önizleme',
    shortTag: 'Cihaz Mockup',
    icon: Smartphone,
    presetKey: 'block-split-hero',
    previewKind: 'split',
    promptLabel: 'an app/device mockup section showing the product on phone and laptop frames',
    englishPrompt: 'an app/device mockup section showing the product on phone and laptop frames',
  },
  {
    id: 'lookbook',
    stepNo: '18',
    page: 2,
    label: 'Lookbook',
    shortTag: 'Editoryal Koleksiyon',
    icon: Palette,
    presetKey: 'slider-hero-showcase',
    previewKind: 'slider',
    promptLabel: 'an editorial lookbook carousel with large imagery',
    englishPrompt: 'an editorial lookbook carousel with large imagery',
  },
  {
    id: 'kpi',
    stepNo: '19',
    page: 3,
    label: 'İstatistikler',
    shortTag: '4’lü Güven Sayacı',
    icon: BarChart3,
    presetKey: 'block-stats-kpi',
    previewKind: 'kpi',
    promptLabel: 'a 4-column numeric KPI/trust counter strip',
    englishPrompt: 'a 4-column numeric KPI/trust counter strip',
  },
  {
    id: 'pricing',
    stepNo: '20',
    page: 3,
    label: 'Fiyatlandırma',
    shortTag: '3 Paket Tablosu',
    icon: CreditCard,
    presetKey: 'block-pricing-tiers',
    previewKind: 'pricing',
    promptLabel: 'a 3-tier pricing table with a highlighted recommended plan',
    englishPrompt: 'a 3-tier pricing table with a highlighted recommended plan',
  },
  {
    id: 'comparison',
    stepNo: '21',
    page: 3,
    label: 'Karşılaştırma Tablosu',
    shortTag: 'Rakip / Paket Tablosu',
    icon: Layers,
    presetKey: 'block-pricing-tiers',
    previewKind: 'list',
    promptLabel: 'a feature comparison table across plans or competitors',
    englishPrompt: 'a feature comparison table across plans or competitors',
  },
  {
    id: 'testimonials',
    stepNo: '22',
    page: 3,
    label: 'Müşteri Yorumları',
    shortTag: 'Sosyal Kanıt',
    icon: MessageSquare,
    presetKey: 'block-features-grid',
    previewKind: 'grid3',
    promptLabel: 'a testimonials section with customer quotes, avatars and ratings',
    englishPrompt: 'a testimonials section with customer quotes, avatars and ratings',
  },
  {
    id: 'faq',
    stepNo: '23',
    page: 3,
    label: 'Soru & Cevap',
    shortTag: 'SSS Akordiyonu',
    icon: HelpCircle,
    presetKey: 'block-faq-accordion',
    previewKind: 'faq',
    promptLabel: 'an FAQ accordion section followed by a conversion call-to-action',
    englishPrompt: 'an FAQ accordion section followed by a conversion call-to-action',
  },
  {
    id: 'newsletter',
    stepNo: '24',
    page: 3,
    label: 'Bülten Kaydı',
    shortTag: 'E-posta Toplama',
    icon: Mail,
    presetKey: 'block-cta-banner',
    previewKind: 'form',
    promptLabel: 'a newsletter signup section with an email field and subscribe button',
    englishPrompt: 'a newsletter signup section with an email field and subscribe button',
  },
  {
    id: 'booking',
    stepNo: '25',
    page: 3,
    label: 'Randevu / Rezervasyon',
    shortTag: 'Takvimli Form',
    icon: Calendar,
    presetKey: 'block-cta-banner',
    previewKind: 'form',
    promptLabel: 'a booking/reservation section with date picker and short form',
    englishPrompt: 'a booking/reservation section with date picker and short form',
  },
  {
    id: 'calculator',
    stepNo: '26',
    page: 3,
    label: 'Hesaplayıcı',
    shortTag: 'Etkileşimli Araç',
    icon: Calculator,
    presetKey: 'block-pricing-tiers',
    previewKind: 'tabs',
    promptLabel: 'an interactive calculator/estimator widget with sliders and live result',
    englishPrompt: 'an interactive calculator/estimator widget with sliders and live result',
  },
  {
    id: 'trust_badges',
    stepNo: '27',
    page: 3,
    label: 'Güven Rozetleri',
    shortTag: 'Sertifika & Garanti',
    icon: ShieldCheck,
    presetKey: 'block-stats-kpi',
    previewKind: 'logos',
    promptLabel: 'a trust badge row with certificates, guarantees and security seals',
    englishPrompt: 'a trust badge row with certificates, guarantees and security seals',
  },
  {
    id: 'team',
    stepNo: '28',
    page: 4,
    label: 'Ekip',
    shortTag: 'Profil Kartları',
    icon: Users,
    presetKey: 'block-features-grid',
    previewKind: 'grid3',
    promptLabel: 'a team section with member portraits, names and roles',
    englishPrompt: 'a team section with member portraits, names and roles',
  },
  {
    id: 'timeline',
    stepNo: '29',
    page: 4,
    label: 'Zaman Çizelgesi',
    shortTag: 'Hikaye & Yol Haritası',
    icon: Clock,
    presetKey: 'block-features-grid',
    previewKind: 'list',
    promptLabel: 'a vertical timeline of milestones or roadmap',
    englishPrompt: 'a vertical timeline of milestones or roadmap',
  },
  {
    id: 'blog_grid',
    stepNo: '30',
    page: 4,
    label: 'Blog / Haberler',
    shortTag: 'Yazı Kartları',
    icon: FileText,
    presetKey: 'block-product-showcase',
    previewKind: 'products',
    promptLabel: 'a blog grid with 3 latest article cards',
    englishPrompt: 'a blog grid with 3 latest article cards',
  },
  {
    id: 'contact_form',
    stepNo: '31',
    page: 4,
    label: 'İletişim Formu',
    shortTag: 'Form & Bilgiler',
    icon: Mail,
    presetKey: 'block-cta-banner',
    previewKind: 'form',
    promptLabel: 'a contact section with a form and contact details',
    englishPrompt: 'a contact section with a form and contact details',
  },
  {
    id: 'careers',
    stepNo: '32',
    page: 4,
    label: 'Kariyer',
    shortTag: 'Açık Pozisyonlar',
    icon: Briefcase,
    presetKey: 'block-cta-banner',
    previewKind: 'list',
    promptLabel: 'a careers section listing open positions with apply buttons',
    englishPrompt: 'a careers section listing open positions with apply buttons',
  },
  {
    id: 'events',
    stepNo: '33',
    page: 4,
    label: 'Etkinlikler',
    shortTag: 'Takvim Listesi',
    icon: Calendar,
    presetKey: 'block-product-showcase',
    previewKind: 'list',
    promptLabel: 'an upcoming events list with dates and registration buttons',
    englishPrompt: 'an upcoming events list with dates and registration buttons',
  },
  {
    id: 'press_kit',
    stepNo: '34',
    page: 4,
    label: 'Basın & Medya',
    shortTag: 'Basın Kiti',
    icon: Megaphone,
    presetKey: 'block-features-grid',
    previewKind: 'logos',
    promptLabel: 'a press & media section with featured-in logos and downloadable press kit',
    englishPrompt: 'a press & media section with featured-in logos and downloadable press kit',
  },
  {
    id: 'awards',
    stepNo: '35',
    page: 4,
    label: 'Ödüller',
    shortTag: 'Başarılar',
    icon: Award,
    presetKey: 'block-stats-kpi',
    previewKind: 'kpi',
    promptLabel: 'an awards and recognitions section with badges',
    englishPrompt: 'an awards and recognitions section with badges',
  },
  {
    id: 'branches',
    stepNo: '36',
    page: 4,
    label: 'Şubeler & Harita',
    shortTag: 'Konum Kartları',
    icon: MapPin,
    presetKey: 'block-features-grid',
    previewKind: 'grid3',
    promptLabel: 'a locations section with branch cards and a map',
    englishPrompt: 'a locations section with branch cards and a map',
  },
  {
    id: 'menu_board',
    stepNo: '37',
    page: 5,
    label: 'Menü / Fiyat Listesi',
    shortTag: 'Kategorili Liste',
    icon: UtensilsCrossed,
    presetKey: 'block-pricing-tiers',
    previewKind: 'list',
    promptLabel: 'a categorized menu or price list with item names, short descriptions and prices',
    englishPrompt: 'a categorized menu or price list with item names, short descriptions and prices',
  },
  {
    id: 'property_listings',
    stepNo: '38',
    page: 5,
    label: 'Portföy İlanları',
    shortTag: 'Filtreli Kartlar',
    icon: Building2,
    presetKey: 'block-product-showcase',
    previewKind: 'products',
    promptLabel: 'a filterable listing grid of properties or projects with image, key specs and price',
    englishPrompt: 'a filterable listing grid of properties or projects with image, key specs and price',
  },
  {
    id: 'service_cards',
    stepNo: '39',
    page: 5,
    label: 'Hizmet Paketleri',
    shortTag: 'İkonlu Kartlar',
    icon: Briefcase,
    presetKey: 'block-features-grid',
    previewKind: 'grid3',
    promptLabel: 'service package cards with icon, short description and a learn-more link',
    englishPrompt: 'service package cards with icon, short description and a learn-more link',
  },
  {
    id: 'process_steps',
    stepNo: '40',
    page: 5,
    label: 'Çalışma Süreci',
    shortTag: 'Adım Adım Akış',
    icon: Clock,
    presetKey: 'block-features-grid',
    previewKind: 'list',
    promptLabel: 'a numbered step-by-step process section explaining how the service works',
    englishPrompt: 'a numbered step-by-step process section explaining how the service works',
  },
  {
    id: 'course_catalog',
    stepNo: '41',
    page: 5,
    label: 'Eğitim / Program Kataloğu',
    shortTag: 'Seviye & Süre Kartları',
    icon: GraduationCap,
    presetKey: 'block-product-showcase',
    previewKind: 'products',
    promptLabel: 'a catalog of courses or programs with level, duration, instructor and enroll button',
    englishPrompt: 'a catalog of courses or programs with level, duration, instructor and enroll button',
  },
  {
    id: 'integrations',
    stepNo: '42',
    page: 5,
    label: 'Entegrasyonlar',
    shortTag: 'Araç Logoları',
    icon: Cpu,
    presetKey: 'block-stats-kpi',
    previewKind: 'logos',
    promptLabel: 'an integrations section showing supported tools and platforms as a logo grid',
    englishPrompt: 'an integrations section showing supported tools and platforms as a logo grid',
  },
  {
    id: 'api_code',
    stepNo: '43',
    page: 5,
    label: 'Kod / API Önizleme',
    shortTag: 'Sekmeli Kod Bloğu',
    icon: Cpu,
    presetKey: 'block-features-grid',
    previewKind: 'tabs',
    promptLabel: 'a developer section with tabbed code snippets and a copy button',
    englishPrompt: 'a developer section with tabbed code snippets and a copy button',
  },
  {
    id: 'shop_categories',
    stepNo: '44',
    page: 5,
    label: 'Kategori Kartları',
    shortTag: 'Görsel Kategori Izgarası',
    icon: Grid,
    presetKey: 'block-product-showcase',
    previewKind: 'gallery',
    promptLabel: 'large image category cards that link to shop collections',
    englishPrompt: 'large image category cards that link to shop collections',
  },
  {
    id: 'featured_product',
    stepNo: '45',
    page: 5,
    label: 'Öne Çıkan Ürün',
    shortTag: 'Büyük Ürün Sahnesi',
    icon: Star,
    presetKey: 'block-split-hero',
    previewKind: 'split',
    promptLabel: 'a featured product spotlight with large image, key benefits, price and add-to-cart button',
    englishPrompt: 'a featured product spotlight with large image, key benefits, price and add-to-cart button',
  },
  {
    id: 'impact_report',
    stepNo: '46',
    page: 6,
    label: 'Etki Raporu',
    shortTag: 'Büyük Sayılar',
    icon: BarChart3,
    presetKey: 'block-stats-kpi',
    previewKind: 'kpi',
    promptLabel: 'an impact section with large animated numbers and short captions',
    englishPrompt: 'an impact section with large animated numbers and short captions',
  },
  {
    id: 'social_feed',
    stepNo: '47',
    page: 6,
    label: 'Sosyal Akış',
    shortTag: 'Instagram Izgarası',
    icon: ImageIcon,
    presetKey: 'block-product-showcase',
    previewKind: 'gallery',
    promptLabel: 'a social media feed grid with latest posts and a follow button',
    englishPrompt: 'a social media feed grid with latest posts and a follow button',
  },
  {
    id: 'reviews_wall',
    stepNo: '48',
    page: 6,
    label: 'Yorum Duvarı',
    shortTag: 'Bento Referanslar',
    icon: MessageSquare,
    presetKey: 'block-features-grid',
    previewKind: 'bento',
    promptLabel: 'a wall of mixed-size review cards with ratings and customer names',
    englishPrompt: 'a wall of mixed-size review cards with ratings and customer names',
  },
  {
    id: 'partner_cta',
    stepNo: '49',
    page: 6,
    label: 'Ortaklık Çağrısı',
    shortTag: 'Partner Olun Bandı',
    icon: Megaphone,
    presetKey: 'block-cta-banner',
    previewKind: 'banner',
    promptLabel: 'a partnership call-to-action banner inviting partners or collaborators',
    englishPrompt: 'a partnership call-to-action banner inviting partners or collaborators',
  },
  {
    id: 'download_app',
    stepNo: '50',
    page: 6,
    label: 'Uygulamayı İndir',
    shortTag: 'Mağaza Butonları',
    icon: Smartphone,
    presetKey: 'block-split-hero',
    previewKind: 'split',
    promptLabel: 'an app download section with phone mockup, QR code and app store buttons',
    englishPrompt: 'an app download section with phone mockup, QR code and app store buttons',
  },
  {
    id: 'map_location',
    stepNo: '51',
    page: 6,
    label: 'Harita & Ulaşım',
    shortTag: 'Adres + Harita',
    icon: MapPin,
    presetKey: 'block-split-hero',
    previewKind: 'split',
    promptLabel: 'a location section with an embedded map, address, opening hours and directions button',
    englishPrompt: 'a location section with an embedded map, address, opening hours and directions button',
  },
  {
    id: 'promo_countdown',
    stepNo: '52',
    page: 6,
    label: 'Kampanya Sayacı',
    shortTag: 'Geri Sayım Bandı',
    icon: Zap,
    presetKey: 'block-cta-banner',
    previewKind: 'banner',
    promptLabel: 'a limited-time promotion banner with countdown timer and discount code',
    englishPrompt: 'a limited-time promotion banner with countdown timer and discount code',
  },
  {
    id: 'video_testimonial',
    stepNo: '53',
    page: 6,
    label: 'Video Referans',
    shortTag: 'Müşteri Hikayesi',
    icon: Play,
    presetKey: 'slider-hero-showcase',
    previewKind: 'video',
    promptLabel: 'a customer story section with a featured video testimonial and pull-quote',
    englishPrompt: 'a customer story section with a featured video testimonial and pull-quote',
  },
  {
    id: 'values',
    stepNo: '54',
    page: 6,
    label: 'Değerlerimiz',
    shortTag: 'Marka İlkeleri',
    icon: ShieldCheck,
    presetKey: 'block-features-grid',
    previewKind: 'grid3',
    promptLabel: 'a brand values section with three to four principles, each with icon and short text',
    englishPrompt: 'a brand values section with three to four principles, each with icon and short text',
  },
];

const BLUEPRINT_RECIPES = [
  {
    id: 'full-corporate',
    label: 'Kurumsal Paket',
    layers: ['navbar', 'hero', 'features', 'kpi', 'faq', 'footer'],
  },
  {
    id: 'ecommerce-store',
    label: 'E-Ticaret Paketi',
    layers: ['navbar', 'hero', 'products', 'slider', 'faq', 'footer'],
  },
  {
    id: 'saas-product',
    label: 'SaaS Paketi',
    layers: ['navbar', 'hero', 'features', 'kpi', 'pricing', 'faq', 'footer'],
  },
  {
    id: 'fast-landing',
    label: 'Minimal Açılış',
    layers: ['navbar', 'hero', 'features', 'footer'],
  },
];

const WIZARD_STEPS = [
  { num: 1, title: 'Kimlik & Tema' },
  { num: 2, title: 'Sayfa Mimarisi' },
  { num: 3, title: 'Özet & Başlat' },
];

const CHIPS_PER_PAGE = 6;
const NOTE_CHIPS_PER_PAGE = 4;
const NOTE_IDEAS = ['Minimal ve ferah', 'Animasyonlu', 'Koyu arka plan', 'Büyük görseller'];

function useWheelPager(ref, page, total, onChange) {
  const stateRef = React.useRef({ page, total, onChange, last: 0 });
  stateRef.current.page = page;
  stateRef.current.total = total;
  stateRef.current.onChange = onChange;
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const handler = (e) => {
      const st = stateRef.current;
      const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (!delta) return;
      const dir = delta > 0 ? 1 : -1;
      const next = st.page + dir;
      if (next < 1 || next > st.total) return;
      e.preventDefault();
      const now = Date.now();
      if (now - st.last < 380) return;
      st.last = now;
      st.onChange(next);
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [ref]);
}

function PagerControl({ page, total, onChange, label }) {
  const rootRef = React.useRef(null);
  const [scopeEl, setScopeEl] = useState(null);
  useEffect(() => {
    setScopeEl(rootRef.current?.closest('[data-wheel-scope]') || rootRef.current);
  }, []);
  const scopeRef = React.useMemo(() => ({ current: scopeEl }), [scopeEl]);
  useWheelPager(scopeRef, page, total, onChange);
  return (
    <div className="wl-pager" ref={rootRef} role="group" aria-label={label || 'Sayfa gezinme'}>
      <button type="button" className="wl-pager__btn" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Önceki">
        <ChevronLeft size={12} />
      </button>
      <div className="wl-pager__dots">
        {Array.from({ length: total }, (_, i) => (
          <button key={i} type="button" className={`wl-pager__dot ${page === i + 1 ? 'is-active' : ''}`} onClick={() => onChange(i + 1)} aria-label={`Sayfa ${i + 1}`} aria-current={page === i + 1} />
        ))}
      </div>
      <button type="button" className="wl-pager__btn" disabled={page >= total} onClick={() => onChange(page + 1)} aria-label="Sonraki">
        <ChevronRight size={12} />
      </button>
    </div>
  );
}

function readOsReducedMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return Boolean(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

/**
 * Sağ Panel: Canlı Mimari Önizleme (Sıfır Taşma, Orantılı Mini Site İskeleti)
 */
function LiveWireframePreview({
  palette,
  brandName,
  sector,
  device,
  onSelectDevice,
  orderedLayers,
  onToggleLayer,
  onFocusLayer,
  focusedLayerId,
  layerNotes,
  activeStep,
}) {
  const displayBrand = String(brandName || '').trim() || sector?.label || 'CRAFT';
  const headlineText = sector?.defaultHeadline || 'Yeni Nesil Dijital Vitrin';
  const frameWidthClass =
    device === 'mobile'
      ? 'wl-preview-browser--mobile'
      : device === 'tablet'
        ? 'wl-preview-browser--tablet'
        : 'wl-preview-browser--desktop';

  return (
    <aside className="wl-wizard-preview" aria-label="Canlı mimari önizleme">
      <div className="wl-wizard-preview__head">
        <div className="wl-wizard-preview__title">
          <span className="wl-wizard-preview__live-dot" aria-hidden="true" />
          <span>CANLI ÖNİZLEME</span>
        </div>

        <div className="wl-wizard-preview__device-tabs" role="group" aria-label="Önizleme cihazı">
          {[
            { id: 'desktop', label: 'Masaüstü', icon: Monitor },
            { id: 'tablet', label: 'Tablet', icon: Tablet },
            { id: 'mobile', label: 'Mobil', icon: Smartphone },
          ].map((dv) => {
            const Icon = dv.icon;
            const isAct = (device || 'desktop') === dv.id;
            return (
              <button
                key={dv.id}
                type="button"
                title={dv.label}
                className={`wl-wizard-preview__dev-btn ${isAct ? 'is-active' : ''}`}
                onClick={() => onSelectDevice?.(dv.id)}
              >
                <Icon size={12} strokeWidth={2.1} />
                <span>{dv.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="wl-wizard-preview__stage">
        <div
          className={`wl-preview-browser ${frameWidthClass}`}
          style={{
            '--pv-bg': palette.bg,
            '--pv-surface': palette.surface,
            '--pv-text': palette.text,
            '--pv-accent': palette.accent,
            '--pv-border': palette.isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.10)',
            '--pv-muted': palette.isLight ? 'rgba(15,23,42,0.52)' : 'rgba(255,255,255,0.52)',
          }}
        >
          <div className="wl-preview-browser__chrome">
            <div className="wl-preview-browser__dots" aria-hidden="true">
              <span className="is-red" />
              <span className="is-yellow" />
              <span className="is-green" />
            </div>
            <div className="wl-preview-browser__url">
              {displayBrand.toLowerCase().replace(/[^a-z0-9]/g, '') || 'stüdyo'}.craft.app
            </div>
            <span className="wl-preview-browser__count">{orderedLayers.length} Katman</span>
          </div>

          <div className="wl-preview-browser__viewport">
            {orderedLayers.map((layer, idx) => (
              <div
                key={layer.id}
                className={`wl-pv-block ${activeStep === 2 ? 'wl-pv-block--clickable' : ''} ${
                  focusedLayerId === layer.id ? 'wl-pv-block--focused' : ''
                }`}
                onClick={() => activeStep === 2 && onFocusLayer?.(layer.id)}
                title={activeStep === 2 ? `${layer.label} için not yaz` : layer.label}
              >
                <div className="wl-pv-block__meta">
                  <span className="wl-pv-block__idx">{String(idx + 1).padStart(2, '0')}</span>
                  <span className="wl-pv-block__name">{layer.label}</span>
                  {layerNotes?.[layer.id] ? <span className="wl-pv-block__note-dot" title="Not var" /> : null}
                  {activeStep === 2 && (
                    <button
                      type="button"
                      className="wl-pv-block__remove"
                      aria-label={`${layer.label} bölümünü kaldır`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleLayer?.(layer.id);
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>

                {layer.previewKind === 'nav' && (
                  <div className="wl-pv-nav">
                    <span className="wl-pv-nav__logo">
                      <i className="wl-pv-nav__mark">{displayBrand.charAt(0).toUpperCase()}</i>
                      <b>{displayBrand.slice(0, 12).toUpperCase()}</b>
                    </span>
                    <div className="wl-pv-nav__links">
                      <span />
                      <span />
                      <span />
                    </div>
                    <span className="wl-pv-nav__cta">Başla</span>
                  </div>
                )}

                {layer.previewKind === 'hero' && (
                  <div className="wl-pv-hero">
                    <div className="wl-pv-hero__copy">
                      <span className="wl-pv-hero__kicker">{sector?.label || 'VİTRİN'}</span>
                      <strong className="wl-pv-hero__headline">{headlineText}</strong>
                      <div className="wl-pv-hero__btns">
                        <span className="wl-pv-hero__btn-primary">Keşfet</span>
                        <span className="wl-pv-hero__btn-ghost">Detay</span>
                      </div>
                    </div>
                    <div className="wl-pv-hero__visual">
                      <Sparkles size={15} />
                    </div>
                  </div>
                )}

                {layer.previewKind === 'slider' && (
                  <div className="wl-pv-slider">
                    <span className="wl-pv-slider__arrow">‹</span>
                    <div className="wl-pv-slider__center">
                      <span className="wl-pv-slider__badge">ETKİLEŞİMLİ KARUSEL</span>
                      <div className="wl-pv-slider__dots">
                        <i className="is-active" />
                        <i />
                        <i />
                      </div>
                    </div>
                    <span className="wl-pv-slider__arrow">›</span>
                  </div>
                )}

                {layer.previewKind === 'grid3' && (
                  <div className="wl-pv-grid3">
                    {['Hızlı Kurulum', 'Modüler Yapı', 'Tam Uyum'].map((ft) => (
                      <div key={ft} className="wl-pv-card">
                        <span className="wl-pv-card__dot" />
                        <b className="wl-pv-card__title">{ft}</b>
                        <span className="wl-pv-card__sub" />
                      </div>
                    ))}
                  </div>
                )}

                {layer.previewKind === 'products' && (
                  <div className="wl-pv-grid3">
                    {['Koleksiyon 01', 'Koleksiyon 02', 'Koleksiyon 03'].map((pr) => (
                      <div key={pr} className="wl-pv-product">
                        <div className="wl-pv-product__img" />
                        <b className="wl-pv-card__title">{pr}</b>
                      </div>
                    ))}
                  </div>
                )}

                {layer.previewKind === 'kpi' && (
                  <div className="wl-pv-kpi">
                    {['%99.9', '24/7', '12K+', '4.9★'].map((stat) => (
                      <div key={stat} className="wl-pv-kpi__item">
                        <strong>{stat}</strong>
                        <span />
                      </div>
                    ))}
                  </div>
                )}

                {layer.previewKind === 'pricing' && (
                  <div className="wl-pv-grid3">
                    {[
                      { name: 'Başlangıç', price: '₺490', pro: false },
                      { name: 'Pro Studio', price: '₺990', pro: true },
                      { name: 'Kurumsal', price: 'Özel', pro: false },
                    ].map((tier) => (
                      <div
                        key={tier.name}
                        className={`wl-pv-price-card ${tier.pro ? 'wl-pv-price-card--pro' : ''}`}
                      >
                        <b className="wl-pv-card__title">{tier.name}</b>
                        <strong className="wl-pv-price-card__val">{tier.price}</strong>
                        <span className="wl-pv-price-card__btn" />
                      </div>
                    ))}
                  </div>
                )}

                {layer.previewKind === 'faq' && (
                  <div className="wl-pv-faq">
                    <div className="wl-pv-faq__row">
                      <span>Sıkça sorulan sorular ve süreç detayları</span>
                      <b>−</b>
                    </div>
                    <div className="wl-pv-faq__row">
                      <span>Teslimat ve özelleştirme seçenekleri</span>
                      <b>+</b>
                    </div>
                  </div>
                )}


                {layer.previewKind === 'banner' && (
                  <div className="wl-pv-banner">
                    <span className="wl-pv-banner__text" />
                    <span className="wl-pv-hero__btn-primary">Başla</span>
                  </div>
                )}
                {layer.previewKind === 'logos' && (
                  <div className="wl-pv-logos">
                    <i /><i /><i /><i /><i />
                  </div>
                )}
                {layer.previewKind === 'split' && (
                  <div className="wl-pv-split">
                    <div className="wl-pv-hero__visual"><Sparkles size={13} /></div>
                    <div className="wl-pv-lines"><span /><span /><span /></div>
                  </div>
                )}
                {layer.previewKind === 'gallery' && (
                  <div className="wl-pv-gallery"><i /><i /><i /><i /><i /><i /></div>
                )}
                {layer.previewKind === 'video' && (
                  <div className="wl-pv-video"><span className="wl-pv-video__play">▶</span></div>
                )}
                {layer.previewKind === 'bento' && (
                  <div className="wl-pv-bento"><i /><i /><i /><i /></div>
                )}
                {layer.previewKind === 'tabs' && (
                  <div className="wl-pv-tabs">
                    <div className="wl-pv-tabs__bar"><b className="is-active" /><b /><b /></div>
                    <div className="wl-pv-lines"><span /><span /></div>
                  </div>
                )}
                {layer.previewKind === 'list' && (
                  <div className="wl-pv-rows">
                    <div><i /><span /></div><div><i /><span /></div><div><i /><span /></div>
                  </div>
                )}
                {layer.previewKind === 'form' && (
                  <div className="wl-pv-form">
                    <span className="wl-pv-form__field" />
                    <span className="wl-pv-hero__btn-primary">Gönder</span>
                  </div>
                )}

                {layer.previewKind === 'footer' && (
                  <div className="wl-pv-footer">
                    <span className="wl-pv-footer__brand">{displayBrand.slice(0, 12).toUpperCase()}</span>
                    <div className="wl-pv-footer__cols">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="wl-wizard-preview__foot">
        <div className="wl-wizard-preview__foot-left">
          <span
            className="wl-wizard-preview__palette-dot"
            style={{ backgroundColor: palette.accent }}
          />
          <span>{palette.label}</span>
        </div>
        <span className="wl-wizard-preview__pill">
          {sector?.label || 'Kurumsal'} ·{' '}
          {device === 'mobile' ? '375px' : device === 'tablet' ? '768px' : '1280px'}
        </span>
      </div>
    </aside>
  );
}

export default function WelcomeAiComposer({
  inputRef,
  promptValue,
  onPromptChange,
  onSubmitPrompt,
  onStartAssembledProject,
  onOpenAiSettings,
  isSubmitting = false,
  isAiConnected = false,
  selectedModelLabel = 'Gemini',
  selectedDevice = 'desktop',
  onSelectDevice,
  reduceMotion = false,
  wizardRequestTick = 0,
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [osReducedMotion, setOsReducedMotion] = useState(() => readOsReducedMotion());
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [stepDirection, setStepDirection] = useState('forward');

  const [brandName, setBrandName] = useState('');
  const [selectedSectorId, setSelectedSectorId] = useState('kurumsal');
  const [selectedPaletteId, setSelectedPaletteId] = useState('obsidian');
  const [layerPage, setLayerPage] = useState(1);
  const [sectorPage, setSectorPage] = useState(1);
  const [notePage, setNotePage] = useState(1);
  const [chipPage, setChipPage] = useState(1);
  const chipCarouselRef = React.useRef(null);
  const [palettePage, setPalettePage] = useState(1);
  const [focusedLayerId, setFocusedLayerId] = useState(null);
  const [layerNotes, setLayerNotes] = useState({});
  const [selectedLayerIds, setSelectedLayerIds] = useState([
    'navbar',
    'hero',
    'features',
    'products',
    'faq',
    'footer',
  ]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setOsReducedMotion(Boolean(mq.matches));
    sync();
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', sync);
      return () => mq.removeEventListener('change', sync);
    }
    return undefined;
  }, []);

  useEffect(() => {
    if (wizardRequestTick > 0) {
      setWizardStep(1);
      setStepDirection('forward');
      setWizardOpen(true);
    }
  }, [wizardRequestTick]);

  useEffect(() => {
    if (!wizardOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setWizardOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [wizardOpen]);

  const motionReduced = Boolean(reduceMotion || osReducedMotion);
  const hasValue = String(promptValue || '').length > 0;

  useEffect(() => {
    if (motionReduced || isFocused || hasValue || wizardOpen) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      const inputEl = inputRef?.current;
      if (inputEl && (document.activeElement === inputEl || inputEl.value.length > 0)) {
        return;
      }
      setPlaceholderIndex((prev) => (prev + 1) % ROTATING_PLACEHOLDERS.length);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [motionReduced, isFocused, hasValue, wizardOpen, inputRef]);

  const activePlaceholder = motionReduced
    ? ROTATING_PLACEHOLDERS[0]
    : ROTATING_PLACEHOLDERS[placeholderIndex] || ROTATING_PLACEHOLDERS[0];

  const activeSector =
    SECTOR_OPTIONS.find((s) => s.id === selectedSectorId) || SECTOR_OPTIONS[0];
  const activePalette =
    PALETTE_OPTIONS.find((p) => p.id === selectedPaletteId) || PALETTE_OPTIONS[0];

  const orderedSelectedLayers = selectedLayerIds
    .map((id) => STEP_LAYERS.find((layer) => layer.id === id))
    .filter(Boolean);
  const activeNoteLayer =
    orderedSelectedLayers.find((l) => l.id === focusedLayerId) || orderedSelectedLayers[0] || null;
  const noteDotStart = Math.max(
    0,
    Math.min(orderedSelectedLayers.indexOf(activeNoteLayer) - 4, orderedSelectedLayers.length - 9)
  );
  const noteDotLayers = orderedSelectedLayers.slice(noteDotStart, noteDotStart + 9);
  const notePageTotal = Math.max(1, Math.ceil(orderedSelectedLayers.length / NOTE_CHIPS_PER_PAGE));
  const safeNotePage = Math.min(notePage, notePageTotal);
  const pageLayers = STEP_LAYERS.filter((l) => l.page === layerPage);

  const inferSectorFromText = (rawText) => {
    const lower = String(rawText || '').toLowerCase();
    if (!lower) return null;
    if (lower.includes('ticaret') || lower.includes('mağaza') || lower.includes('ürün') || lower.includes('butik') || lower.includes('satış') || lower.includes('takı')) {
      return SECTOR_OPTIONS.find((s) => s.id === 'eticaret');
    }
    if (lower.includes('saas') || lower.includes('yazılım') || lower.includes('uygulama') || lower.includes('yapay zeka') || lower.includes('ai')) {
      return SECTOR_OPTIONS.find((s) => s.id === 'saas');
    }
    if (lower.includes('mimar') || lower.includes('emlak') || lower.includes('inşaat') || lower.includes('konut') || lower.includes('villa')) {
      return SECTOR_OPTIONS.find((s) => s.id === 'mimarlik');
    }
    if (lower.includes('kafe') || lower.includes('kahve') || lower.includes('restoran') || lower.includes('menü') || lower.includes('yemek') || lower.includes('gastronomi')) {
      return SECTOR_OPTIONS.find((s) => s.id === 'restoran');
    }
    if (lower.includes('portfolyo') || lower.includes('tasarımcı') || lower.includes('fotoğraf') || lower.includes('kişisel') || lower.includes('ajans')) {
      return SECTOR_OPTIONS.find((s) => s.id === 'portfolyo');
    }
    const extra = [
      [['eğitim', 'kurs', 'akademi', 'okul'], 'egitim'],
      [['klinik', 'sağlık', 'doktor', 'diyet', 'diş'], 'saglik'],
      [['fotoğraf stüdyo', 'çekim', 'düğün'], 'fotograf'],
      [['otel', 'tatil', 'konaklama', 'pansiyon'], 'otel'],
      [['spor', 'fitness', 'gym', 'koç'], 'fitness'],
      [['avukat', 'hukuk', 'finans', 'muhasebe'], 'hukuk'],
      [['etkinlik', 'konferans', 'festival', 'organizasyon'], 'etkinlik'],
    ];
    for (const [keys, id] of extra) {
      if (keys.some((k) => lower.includes(k))) return SECTOR_OPTIONS.find((s) => s.id === id);
    }
    return null;
  };

  const applySectorDefaults = (sector) => {
    if (!sector) return;
    setSelectedSectorId(sector.id);
    if (sector.defaultPalette) {
      setSelectedPaletteId(sector.defaultPalette);
    }
    if (Array.isArray(sector.defaultLayers)) {
      setSelectedLayerIds(sector.defaultLayers);
    }
  };

  useWheelPager(chipCarouselRef, chipPage, Math.ceil(SECTOR_OPTIONS.length / CHIPS_PER_PAGE), setChipPage);

  const handleStartWizardFromHero = (event) => {
    event?.preventDefault?.();
    const raw = String(promptValue || '').trim();
    if (raw) {
      const inferred = inferSectorFromText(raw);
      if (inferred) {
        applySectorDefaults(inferred);
      }
    } else {
      onPromptChange(activeSector.defaultPrompt);
    }
    setWizardStep(1);
    setStepDirection('forward');
    setWizardOpen(true);
  };

  const handlePickSectorChip = (sector) => {
    applySectorDefaults(sector);
    onPromptChange(sector.defaultPrompt);
    setWizardStep(1);
    setStepDirection('forward');
    setWizardOpen(true);
  };

  const handleSelectSectorInsideWizard = (sector) => {
    applySectorDefaults(sector);
    const currentPrompt = String(promptValue || '').trim();
    const isDefaultPrompt = SECTOR_OPTIONS.some((s) => s.defaultPrompt === currentPrompt);
    if (!currentPrompt || isDefaultPrompt) {
      onPromptChange(sector.defaultPrompt);
    }
  };

  const goToStep = (nextStep) => {
    if (nextStep === wizardStep || nextStep < 1 || nextStep > 3) return;
    setStepDirection(nextStep > wizardStep ? 'forward' : 'backward');
    setWizardStep(nextStep);
  };

  const stepNoteLayer = (dir) => {
    const n = orderedSelectedLayers.length;
    if (n < 2) return;
    const cur = Math.max(0, orderedSelectedLayers.findIndex((l) => l.id === activeNoteLayer?.id));
    setFocusedLayerId(orderedSelectedLayers[(cur + dir + n) % n].id);
  };

  const appendNoteIdea = (idea) => {
    if (!activeNoteLayer) return;
    setLayerNotes((prev) => {
      const cur = String(prev[activeNoteLayer.id] || '').trim();
      if (cur.toLowerCase().includes(idea.toLowerCase())) return prev;
      return { ...prev, [activeNoteLayer.id]: (cur ? `${cur}, ` : '') + idea.toLowerCase() };
    });
  };

  const handleToggleLayer = (layerId) => {
    setSelectedLayerIds((prev) => {
      if (prev.includes(layerId)) {
        if (prev.length <= 1) return prev;
        return prev.filter((id) => id !== layerId);
      }
      return [...prev, layerId];
    });
    setFocusedLayerId(layerId);
  };

  const buildPresetKeysFromSelection = () => {
    const keys = [];
    orderedSelectedLayers.forEach((layer) => {
      if (layer.id === 'navbar') {
        keys.push(activePalette.navPreset || 'nav-corporate-dark');
      } else if (layer.id === 'footer') {
        keys.push(activePalette.footerPreset || 'footer-modern-directory');
      } else if (layer.id === 'faq') {
        keys.push('block-faq-accordion');
        keys.push('block-cta-banner');
      } else {
        keys.push(layer.presetKey);
      }
    });
    return keys;
  };

  const synthesizeBlueprintPrompt = () => {
    const userRaw = String(promptValue || '').trim();
    const cleanBrand = String(brandName || '').trim();
    const lines = [];
    lines.push('Build a complete, high-craft, modern, responsive website.');
    lines.push(`Goal: ${userRaw || activeSector.defaultPrompt}`);
    if (cleanBrand) lines.push(`Brand name: "${cleanBrand}"`);
    lines.push(`Sector: ${activeSector.label} (${activeSector.sub})`);
    lines.push(
      `Color theme "${activePalette.label}": background ${activePalette.bg}, surface ${activePalette.surface}, text ${activePalette.text}, accent ${activePalette.accent}. Use these exact hex colors consistently.`
    );
    lines.push('Page structure, strictly in this top-to-bottom order:');
    orderedSelectedLayers.forEach((l, idx) => {
      const note = String(layerNotes[l.id] || '').trim();
      lines.push(`${idx + 1}) ${l.label}: ${l.englishPrompt}.${note ? ` Custom requirement for this section: "${note}"` : ''}`);
    });
    lines.push('Write all visible copy in the language that matches the goal above, use polished typography and consistent spacing.');
    return lines.join('\n');
  };

  const handleAssembleBlocksNow = () => {
    if (!onStartAssembledProject) return;
    const cleanBrand = String(brandName || '').trim();
    const presetKeys = buildPresetKeysFromSelection();
    setWizardOpen(false);
    onStartAssembledProject({
      name: cleanBrand
        ? `${cleanBrand} — ${activeSector.label}`
        : `${activeSector.label} Sitesi`,
      tabName: 'Anasayfa.craft',
      presetKeys,
      backgroundColor: activePalette.bg,
      device: selectedDevice || 'desktop',
      brandName: cleanBrand || activeSector.label,
      heroHeadline: activeSector.defaultHeadline,
      heroSubtitle: String(promptValue || '').trim() || activeSector.defaultPrompt,
    });
  };

  const handleGenerateWithAi = () => {
    if (isSubmitting) return;
    const finalPrompt = synthesizeBlueprintPrompt();
    onPromptChange(finalPrompt);
    const cleanBrand = String(brandName || '').trim();
    setWizardOpen(false);
    onSubmitPrompt(finalPrompt, {
      projectName: cleanBrand
        ? `${cleanBrand} — ${activeSector.label}`
        : `${activeSector.label} Projesi`,
      backgroundColor: activePalette.bg,
      device: selectedDevice || 'desktop',
      brandName: cleanBrand,
      presetKeys: [],
    });
  };

  const portalTarget =
    typeof document !== 'undefined'
      ? document.querySelector('[data-welcome-root]') || document.body
      : null;

  const wizardModalNode =
    wizardOpen && portalTarget
      ? createPortal(
          <div
            className="wl-wizard-backdrop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="wl-wizard-dialog-title"
            onClick={(e) => {
              if (e.target === e.currentTarget) setWizardOpen(false);
            }}
          >
            <div className="wl-wizard-dialog">
              <header className="wl-wizard-header">
                <div className="wl-wizard-brand">
                  <span className="wl-wizard-brand__icon" aria-hidden="true">
                    <Sparkles size={15} strokeWidth={2.2} />
                  </span>
                  <div className="wl-wizard-brand__copy">
                    <div className="wl-wizard-brand__title-row">
                      <span className="wl-wizard-brand__title">Site Kurgulayıcı</span>
                      <span className="wl-wizard-brand__badge">STUDIO AI</span>
                    </div>
                    <span className="wl-wizard-brand__sub">
                      Adım adım mimari ve görsel kurgu stüdyosu
                    </span>
                  </div>
                </div>

                <nav className="wl-wizard-stepper" aria-label="Kurgu adımları">
                  {WIZARD_STEPS.map((st, idx) => {
                    const isActive = wizardStep === st.num;
                    const isDone = wizardStep > st.num;
                    return (
                      <React.Fragment key={st.num}>
                        <button
                          type="button"
                          className={`wl-wizard-step-tab ${isActive ? 'is-active' : ''} ${
                            isDone ? 'is-done' : ''
                          }`}
                          onClick={() => goToStep(st.num)}
                        >
                          <span className="wl-wizard-step-tab__num">
                            {isDone ? <Check size={12} strokeWidth={2.8} /> : `0${st.num}`}
                          </span>
                          <span className="wl-wizard-step-tab__label">{st.title}</span>
                        </button>
                        {idx < WIZARD_STEPS.length - 1 && (
                          <span
                            className={`wl-wizard-step-line ${
                              wizardStep > st.num ? 'is-filled' : ''
                            }`}
                            aria-hidden="true"
                          />
                        )}
                      </React.Fragment>
                    );
                  })}
                </nav>

                <div className="wl-wizard-header__actions">
                  <span className="wl-wizard-esc-pill" aria-hidden="true">
                    ESC
                  </span>
                  <button
                    type="button"
                    className="wl-wizard-close"
                    onClick={() => setWizardOpen(false)}
                    aria-label="Kapat"
                  >
                    <X size={16} />
                  </button>
                </div>
              </header>

              <div className="wl-wizard-body">
                <div className="wl-wizard-stage">
                  <div
                    key={wizardStep}
                    className={`wl-wizard-step-pane wl-wizard-step-pane--${stepDirection}`}
                  >
                    {wizardStep === 1 && (
                      <div className="wl-step-content">
                        <div className="wl-step-head">
                          <span className="wl-step-head__kicker">
                            ADIM 01 / 03 · PROJE KİMLİĞİ & TEMA
                          </span>
                          <h2 id="wl-wizard-dialog-title" className="wl-step-head__title">
                            Projenin kimliğini ve renk temasını seçin
                          </h2>
                        </div>

                        {/* Sitenin Amacı (Prompt) & Marka Adı */}
                        <div className="wl-step1-top-row">
                          <div className="wl-field-box">
                            <label
                              className="wl-field-box__label"
                              htmlFor="wl-goal-prompt-input"
                            >
                              <Sparkles size={12} />
                              <span>Sitenin Amacı / Prompt</span>
                            </label>
                            <input
                              id="wl-goal-prompt-input"
                              type="text"
                              className="wl-field-box__input"
                              placeholder="Örn: Modern mimarlık ofisi portfolyo sitesi..."
                              value={promptValue}
                              onChange={(e) => onPromptChange(e.target.value)}
                            />
                          </div>

                          <div className="wl-field-box">
                            <label
                              className="wl-field-box__label"
                              htmlFor="wl-brand-name-input"
                            >
                              <Building2 size={12} />
                              <span>Marka / Proje Adı</span>
                            </label>
                            <input
                              id="wl-brand-name-input"
                              type="text"
                              className="wl-field-box__input"
                              placeholder="Örn: Aurelia, Nova Studio..."
                              value={brandName}
                              onChange={(e) => setBrandName(e.target.value)}
                              maxLength={32}
                            />
                          </div>
                        </div>

                        {/* Sektör / Site Kategorisi Seçimi */}
                        <div className="wl-field-box" data-wheel-scope="true">
                          <div className="wl-field-box__row">
                            <span className="wl-field-box__label">
                              <Compass size={12} />
                              <span>Site Türü & Sektör</span>
                            </span>
                            <PagerControl page={sectorPage} total={Math.ceil(SECTOR_OPTIONS.length / 6)} onChange={setSectorPage} label="Sektör sayfaları" />
                          </div>
                          <div
                            className="wl-sector-grid"
                            role="radiogroup"
                            aria-label="Sektör seçimi"
                          >
                            {SECTOR_OPTIONS.slice((sectorPage - 1) * 6, sectorPage * 6).map((sec) => {
                              const Icon = sec.icon;
                              const isSelected = selectedSectorId === sec.id;
                              return (
                                <button
                                  key={sec.id}
                                  type="button"
                                  role="radio"
                                  aria-checked={isSelected}
                                  className={`wl-sector-card ${isSelected ? 'is-active' : ''}`}
                                  onClick={() => handleSelectSectorInsideWizard(sec)}
                                >
                                  <span className="wl-sector-card__icon">
                                    <Icon size={15} strokeWidth={2} />
                                  </span>
                                  <span className="wl-sector-card__copy">
                                    <b className="wl-sector-card__title">{sec.label}</b>
                                    <small className="wl-sector-card__sub">{sec.sub}</small>
                                  </span>
                                  <span
                                    className={`wl-sector-card__check ${
                                      isSelected ? 'is-visible' : ''
                                    }`}
                                    aria-hidden="true"
                                  >
                                    <Check size={10} strokeWidth={3} />
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Renk Teması Seçimi (3x2 Yatay Stüdyo Kartları) */}
                        <div className="wl-field-box" data-wheel-scope="true">
                          <div className="wl-field-box__row">
                            <span className="wl-field-box__label">
                              <Palette size={12} />
                              <span>Görsel Stil & Renk Teması</span>
                            </span>
                            <PagerControl page={palettePage} total={Math.ceil(PALETTE_OPTIONS.length / 6)} onChange={setPalettePage} label="Renk teması sayfaları" />
                          </div>
                          <div
                            className="wl-palette-grid"
                            role="radiogroup"
                            aria-label="Renk teması"
                          >
                            {PALETTE_OPTIONS.slice((palettePage - 1) * 6, palettePage * 6).map((pal) => {
                              const isSelected = selectedPaletteId === pal.id;
                              return (
                                <button
                                  key={pal.id}
                                  type="button"
                                  role="radio"
                                  aria-checked={isSelected}
                                  className={`wl-palette-card ${isSelected ? 'is-active' : ''}`}
                                  style={{ '--pal-accent': pal.accent }}
                                  onClick={() => setSelectedPaletteId(pal.id)}
                                >
                                  <span
                                    className="wl-palette-card__swatch"
                                    style={{
                                      background: `linear-gradient(135deg, ${pal.bg} 45%, ${pal.surface} 100%)`,
                                    }}
                                    aria-hidden="true"
                                  >
                                    <i
                                      className="wl-palette-card__orb"
                                      style={{
                                        backgroundColor: pal.accent,
                                        boxShadow: `0 0 10px ${pal.accent}`,
                                      }}
                                    />
                                  </span>

                                  <span className="wl-palette-card__copy">
                                    <b className="wl-palette-card__title">{pal.label}</b>
                                    <small className="wl-palette-card__sub">{pal.desc}</small>
                                  </span>

                                  <span className="wl-palette-card__right" aria-hidden="true">
                                    <span className="wl-palette-card__mini-dots">
                                      <i style={{ backgroundColor: pal.bg }} />
                                      <i style={{ backgroundColor: pal.accent }} />
                                    </span>
                                    <span
                                      className={`wl-sector-card__check ${
                                        isSelected ? 'is-visible' : ''
                                      }`}
                                    >
                                      <Check size={10} strokeWidth={3} />
                                    </span>
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {wizardStep === 2 && (
                      <div className="wl-step-content wl-step-content--arch">
                        <div className="wl-step-head">
                          <span className="wl-step-head__kicker">
                            ADIM 02 / 03 · SAYFA MİMARİSİ
                          </span>
                          <h2 id="wl-wizard-dialog-title" className="wl-step-head__title">
                            Sitenizde yer alacak bölümleri seçin
                          </h2>
                        </div>

                        <div className="wl-layer-scope" data-wheel-scope="true">
                        <div className="wl-layer-slider-bar">
                          <div className="wl-layer-slider-bar__title">
                            <b>{LAYER_PAGES[layerPage - 1].title}</b>
                            <span>
                              {layerPage}/{LAYER_PAGES.length}
                              {orderedSelectedLayers.filter((l) => l.page === layerPage).length > 0
                                ? ` · ${orderedSelectedLayers.filter((l) => l.page === layerPage).length} seçili`
                                : ''}
                            </span>
                          </div>
                          <div className="wl-layer-slider-bar__right">
                            <button type="button" className="wl-preset-all-btn" onClick={() => { setSelectedLayerIds(['navbar']); setFocusedLayerId('navbar'); }}>
                              <RotateCcw size={11} /> Sıfırla
                            </button>
                            <PagerControl page={layerPage} total={LAYER_PAGES.length} onChange={setLayerPage} label="Bölüm sayfaları" />
                          </div>
                        </div>

                        <div
                          className="wl-layer-toggles-grid"
                          role="group"
                          aria-label="Sayfa katmanları"
                        >
                          {pageLayers.map((layer) => {
                            const Icon = layer.icon || Layers;
                            const isChecked = selectedLayerIds.includes(layer.id);
                            const orderPos = orderedSelectedLayers.findIndex(
                              (l) => l.id === layer.id
                            );
                            return (
                              <button
                                key={layer.id}
                                type="button"
                                aria-pressed={isChecked}
                                className={`wl-layer-toggle ${isChecked ? 'is-selected' : ''}`}
                                onClick={() => handleToggleLayer(layer.id)}
                              >
                                <span className="wl-layer-toggle__icon-box" aria-hidden="true">
                                  <Icon size={15} strokeWidth={2} />
                                </span>
                                <div className="wl-layer-toggle__copy">
                                  <span className="wl-layer-toggle__title">{layer.label}</span>
                                  <span className="wl-layer-toggle__tag">{layer.shortTag}</span>
                                </div>
                                <span className="wl-layer-toggle__badge" aria-hidden="true">
                                  {isChecked ? `${orderPos + 1}` : '+'}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                        </div>

                        <div className="wl-nb-section">
                          <div className="wl-nb-section__head">
                            <MessageSquare size={12} />
                            <b>Bölüm Notları</b>
                            <span>Seçtiğin bölümler için yapay zekaya özel talimat bırak</span>
                          </div>
                        <div className="wl-nb">
                          {activeNoteLayer ? (
                            (() => {
                              const NoteIcon = activeNoteLayer.icon || Layers;
                              const pos = orderedSelectedLayers.indexOf(activeNoteLayer);
                              const noteVal = layerNotes[activeNoteLayer.id] || '';
                              return (
                                <>
                                  <div className="wl-nb__side">
                                    <div className="wl-nb__top">
                                      <span className="wl-nb__icon"><NoteIcon size={15} strokeWidth={2} /></span>
                                      <span className="wl-nb__pos">{pos + 1}<small>/{orderedSelectedLayers.length}</small></span>
                                      <button type="button" className="wl-nb__remove" aria-label="Bölümü kaldır" title="Bölümü kaldır" disabled={orderedSelectedLayers.length < 2} onClick={() => handleToggleLayer(activeNoteLayer.id)}><X size={11} /></button>
                                    </div>
                                    <div className="wl-nb__who">
                                      <b>{activeNoteLayer.label}</b>
                                      <small>{activeNoteLayer.shortTag}</small>
                                    </div>
                                    <div className="wl-nb__nav">
                                      <button type="button" aria-label="Önceki bölüm" disabled={orderedSelectedLayers.length < 2} onClick={() => stepNoteLayer(-1)}><ChevronLeft size={12} /></button>
                                      <div className="wl-nb__dots" aria-hidden="true">
                                        {noteDotLayers.map((l) => (
                                          <i key={l.id} className={`${l.id === activeNoteLayer.id ? 'is-active' : ''} ${layerNotes[l.id] ? 'has-note' : ''}`} />
                                        ))}
                                      </div>
                                      <button type="button" aria-label="Sonraki bölüm" disabled={orderedSelectedLayers.length < 2} onClick={() => stepNoteLayer(1)}><ChevronRight size={12} /></button>
                                    </div>
                                  </div>
                                  <div className="wl-nb__main">
                                    <div className="wl-nb__editor">
                                      <textarea
                                        rows={3}
                                        className="wl-nb__input"
                                        maxLength={400}
                                        placeholder={`${activeNoteLayer.label} nasıl olsun? Yapay zekaya özel talimat yaz…`}
                                        value={noteVal}
                                        onChange={(e) => setLayerNotes((prev) => ({ ...prev, [activeNoteLayer.id]: e.target.value }))}
                                      />
                                      <span className="wl-nb__count">{noteVal.length}/400</span>
                                    </div>
                                    <div className="wl-nb__ideas">
                                      {NOTE_IDEAS.map((idea) => (
                                        <button key={idea} type="button" onClick={() => appendNoteIdea(idea)}>+ {idea}</button>
                                      ))}
                                      {noteVal ? (
                                        <button type="button" className="is-clear" onClick={() => setLayerNotes((prev) => ({ ...prev, [activeNoteLayer.id]: '' }))}>Temizle</button>
                                      ) : null}
                                    </div>
                                  </div>
                                </>
                              );
                            })()
                          ) : null}
                        </div>
                        </div>
                      </div>
                    )}

                    {wizardStep === 3 && (
                      <div className="wl-step-content">
                        <div className="wl-step-head">
                          <span className="wl-step-head__kicker">
                            ADIM 03 / 03 · ONAY & BAŞLATMA
                          </span>
                          <h2 id="wl-wizard-dialog-title" className="wl-step-head__title">
                            Kurgunuz hazır, nasıl başlatmak istersiniz?
                          </h2>
                        </div>

                        <div className="wl-summary-strip">
                          <div className="wl-summary-item">
                            <span className="wl-summary-item__label">Marka & Tür</span>
                            <strong className="wl-summary-item__val">
                              {String(brandName || '').trim() || activeSector.label}
                            </strong>
                          </div>
                          <div className="wl-summary-item">
                            <span className="wl-summary-item__label">Renk Teması</span>
                            <strong className="wl-summary-item__val">{activePalette.label}</strong>
                          </div>
                          <div className="wl-summary-item">
                            <span className="wl-summary-item__label">Hedef Ekran</span>
                            <strong className="wl-summary-item__val">
                              {selectedDevice === 'mobile'
                                ? 'Mobil (375px)'
                                : selectedDevice === 'tablet'
                                  ? 'Tablet (768px)'
                                  : 'Masaüstü (1280px)'}
                            </strong>
                          </div>
                          <div className="wl-summary-item">
                            <span className="wl-summary-item__label">Mimari</span>
                            <strong className="wl-summary-item__val">
                              {orderedSelectedLayers.length} Katman Seçili
                            </strong>
                          </div>
                        </div>

                        <div className="wl-summary-flow">
                          <span className="wl-summary-flow__label">Sayfa Akışı:</span>
                          <div className="wl-summary-flow__chips">
                            {orderedSelectedLayers.map((layer, idx) => (
                              <span key={layer.id} className="wl-summary-flow__chip">
                                <b>{idx + 1}.</b> {layer.label}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="wl-launch-cards">
                          <div className="wl-launch-card wl-launch-card--instant">
                            <div className="wl-launch-card__top">
                              <span className="wl-launch-card__icon wl-launch-card__icon--blue">
                                <Layers size={18} strokeWidth={2} />
                              </span>
                              <span className="wl-launch-card__badge">ANINDA KURULUM</span>
                            </div>
                            <h3 className="wl-launch-card__title">Seçili Katmanları Tuvale Diz</h3>
                            <p className="wl-launch-card__desc">
                              Seçtiğiniz {orderedSelectedLayers.length} modüler bileşeni beklemeden
                              doğrudan tuvale yerleştirir.
                            </p>
                            <button
                              type="button"
                              className="wl-launch-card__btn wl-launch-card__btn--assemble"
                              onClick={handleAssembleBlocksNow}
                            >
                              <Zap size={14} strokeWidth={2.2} />
                              <span>Anında Tuvale Diz</span>
                            </button>
                          </div>

                          <div className="wl-launch-card wl-launch-card--ai">
                            <div className="wl-launch-card__top">
                              <span className="wl-launch-card__icon wl-launch-card__icon--grad">
                                <Wand2 size={18} strokeWidth={2} />
                              </span>
                              <span className="wl-launch-card__badge wl-launch-card__badge--ai">
                                GEMINI AI
                              </span>
                            </div>
                            <h3 className="wl-launch-card__title">Yapay Zeka ile Özel Üret</h3>
                            <p className="wl-launch-card__desc">
                              Girdiğiniz amaca, markaya ve seçili katmanlara özel tasarımı Gemini AI
                              ile sıfırdan üretir.
                            </p>
                            <button
                              type="button"
                              className="wl-launch-card__btn wl-launch-card__btn--ai"
                              disabled={isSubmitting}
                              onClick={handleGenerateWithAi}
                            >
                              <Sparkles size={14} strokeWidth={2.2} />
                              <span>AI ile Üret ve Aç</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <footer className="wl-wizard-footer">
                    <div className="wl-wizard-footer__left">
                      {wizardStep > 1 ? (
                        <button
                          type="button"
                          className="welcome-btn welcome-btn--ghost"
                          onClick={() => goToStep(wizardStep - 1)}
                        >
                          <ArrowLeft size={14} strokeWidth={2.1} />
                          <span>Önceki Adım</span>
                        </button>
                      ) : (
                        <span className="wl-wizard-footer__hint">
                          Seçimleriniz sağdaki canlı önizlemeye anında yansır.
                        </span>
                      )}
                    </div>

                    <div className="wl-wizard-footer__right">
                      {wizardStep < 3 ? (
                        <>
                          <button
                            type="button"
                            className="welcome-btn welcome-btn--ghost"
                            onClick={handleAssembleBlocksNow}
                          >
                            <Zap size={13} strokeWidth={2.1} />
                            <span>Hızlı Diz</span>
                          </button>
                          <button
                            type="button"
                            className="welcome-btn welcome-btn--ai-build"
                            onClick={() => goToStep(wizardStep + 1)}
                          >
                            <span>Devam Et</span>
                            <ArrowRight size={14} strokeWidth={2.3} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="welcome-btn welcome-btn--ghost"
                            onClick={handleAssembleBlocksNow}
                          >
                            <Zap size={13} strokeWidth={2.1} />
                            <span>Katmanları Diz</span>
                          </button>
                          <button
                            type="button"
                            className="welcome-btn welcome-btn--ai-build"
                            disabled={isSubmitting}
                            onClick={handleGenerateWithAi}
                          >
                            <Sparkles size={14} strokeWidth={2.2} />
                            <span>AI ile Üret</span>
                          </button>
                        </>
                      )}
                    </div>
                  </footer>
                </div>

                <LiveWireframePreview
                  palette={activePalette}
                  brandName={brandName}
                  sector={activeSector}
                  device={selectedDevice || 'desktop'}
                  onSelectDevice={onSelectDevice}
                  orderedLayers={orderedSelectedLayers}
                  onToggleLayer={handleToggleLayer}
                  onFocusLayer={setFocusedLayerId}
                  focusedLayerId={activeNoteLayer?.id}
                  layerNotes={layerNotes}
                  activeStep={wizardStep}
                />
              </div>
            </div>
          </div>,
          portalTarget
        )
      : null;

  return (
    <section
      className="welcome-hero welcome-hero--spotlight"
      aria-labelledby="welcome-hero-heading"
    >
      <div className="welcome-hero__glow" aria-hidden="true" />
      <div className="welcome-hero__grid" aria-hidden="true" />

      <div className="welcome-hero__center">
        <span className="welcome-hero__kicker-pill">
          <Sparkles size={11} strokeWidth={2.3} aria-hidden="true" />
          <span>AI WEB CRAFTER</span>
        </span>

        <h1 id="welcome-hero-heading" className="welcome-hero__title">
          Hayal et, <span className="welcome-hero__title-accent">tane tane inşa et.</span>
        </h1>

        <div className="welcome-composer-ring">
          <form className="welcome-composer-form" onSubmit={handleStartWizardFromHero}>
            <span className="welcome-composer__icon" aria-hidden="true">
              <Sparkles size={20} strokeWidth={2.1} />
            </span>

            <input
              ref={inputRef}
              type="text"
              className="welcome-composer__input"
              aria-label="Sitenizin amacını yazın"
              value={promptValue}
              onChange={(e) => onPromptChange(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={activePlaceholder}
            />

            <div className="welcome-composer__actions">
              <button
                type="button"
                className="welcome-gemini-chip"
                onClick={onOpenAiSettings}
                title="Gemini modeli ve API anahtarı"
              >
                <span
                  className={`welcome-status-dot ${isAiConnected ? 'welcome-status-dot--connected' : ''}`}
                  aria-hidden="true"
                />
                <span>{selectedModelLabel}</span>
              </button>

              <button
                type="submit"
                className="welcome-composer__submit"
                disabled={isSubmitting}
              >
                <span>Kurgula</span>
                <ArrowRight size={15} strokeWidth={2.3} aria-hidden="true" />
              </button>
            </div>
          </form>
        </div>

        <div className="welcome-chip-carousel" ref={chipCarouselRef} role="group" aria-label="Hızlı kategoriler">
          <div className="welcome-chip-carousel__viewport">
            <div className="welcome-chip-carousel__track" style={{ transform: `translateX(-${(chipPage - 1) * 100}%)` }}>
              {Array.from({ length: Math.ceil(SECTOR_OPTIONS.length / CHIPS_PER_PAGE) }, (_, pg) => (
                <div key={pg} className="welcome-chip-carousel__page" aria-hidden={chipPage !== pg + 1}>
                  {SECTOR_OPTIONS.slice(pg * CHIPS_PER_PAGE, (pg + 1) * CHIPS_PER_PAGE).map((sec) => {
                    const Icon = sec.icon;
                    return (
                      <button key={sec.id} type="button" tabIndex={chipPage === pg + 1 ? 0 : -1} className="welcome-chip" onClick={() => handlePickSectorChip(sec)}>
                        <Icon size={13} strokeWidth={2} aria-hidden="true" />
                        <span>{sec.label}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          <div className="welcome-chip-carousel__dots">
            {Array.from({ length: Math.ceil(SECTOR_OPTIONS.length / CHIPS_PER_PAGE) }, (_, i) => (
              <button key={i} type="button" className={`welcome-chip-carousel__dot ${chipPage === i + 1 ? 'is-active' : ''}`} aria-label={`Site türleri ${i + 1}. sayfa`} onClick={() => setChipPage(i + 1)} />
            ))}
          </div>
        </div>
      </div>

      {wizardModalNode}
    </section>
  );
}
