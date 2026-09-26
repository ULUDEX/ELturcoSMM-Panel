# Proje Durumu

Son güncelleme: 22 Eylül 2026

## Çalışan bölümler

- Mobil uyumlu ELTURCO SMM müşteri arayüzü
- Kategoriye göre hizmet seçme ve tutar hesaplama
- Sipariş oluşturma, kaydetme ve sağlayıcıya iletmeyi deneme
- Admin oturumu ve 15 dakikalık başarısız giriş sınırlaması
- Hizmet ekleme, düzenleme, aktif/pasif yapma ve silme
- Sipariş, ödeme talebi, gelir-gider ve destek yönetimi
- Site metinleri ve görünürlük ayarları
- Müzik listesi ve R2 medya yükleme altyapısı
- D1 veritabanı şeması ve migration geçmişi
- Shopier imzalı checkout ve idempotent bakiye yazımı (anahtarlar eklenince etkinleşir)
- SMM sağlayıcı API ve reseller API uçları

## Canlı ortam bilgisi

- Cloud/Sites yayını: ELTURCO SMM Panel
- Özel alan adı hedefi: `elturcosmm.com`
- Sites proje kimliği: `.openai/hosting.json` içinde kayıtlıdır.
- Eski KıvılDigital adı ve bağlantıları bu projeden kaldırılmalıdır; ELTURCO SMM tek marka olarak kullanılmalıdır.

## Canlıya almadan önce tamamlanacaklar

1. Hosting ortamına yeni `ADMIN_PASSWORD` ve rastgele `ADMIN_SESSION_SECRET` girin.
2. PanelFollows sağlayıcısının URL ve API anahtarını ekleyin; küçük bir test siparişi yapın.
3. Shopier API anahtarı, secret ve kişisel erişim anahtarını hosting ortamında `SHOPIER_API_KEY`, `SHOPIER_API_SECRET`, `SHOPIER_ACCESS_TOKEN` olarak tanımlayın.
4. `SHOPIER_CALLBACK_URL=https://elturcosmm.com/api/shopier/webhook` ayarlayıp başarılı ve başarısız ödeme dönüşlerini test edin.
5. `elturcosmm.com` DNS kayıtlarını seçilen hosting sağlayıcısına bağlayın.
6. `public/site/audio` içindeki tüm ses dosyalarının ticari yayın hakkını kontrol edin.

## Bilinen ürün eksikleri

- Müşteri üyeliği ve müşteriye özel kalıcı bakiye ekranı tam ürün akışı olarak bitmiş değil.
- Sipariş takibi müşteri hesabına bağlı değil.
- Shopier API anahtarı, secret ve kişisel erişim anahtarı olmadan ödeme başlatılamaz/doğrulanamaz; bu bilgiler Git'e eklenmemelidir.
- Sağlayıcı API bilgileri olmadan siparişler otomatik teslim edilmez; admin panelinde beklemede kalır.
- Üretim öncesi uçtan uca ödeme, webhook ve sağlayıcı hata senaryosu testi gerekir.

## Dosya haritası

- `app/page.tsx`: Ana site kabuğu
- `public/site/`: Müşteri panelinin HTML/CSS/JS ve medya dosyaları
- `app/admin/`: Admin giriş ve yönetim arayüzü
- `app/api/`: Sipariş, hizmet, destek, ödeme ve admin API'leri
- `db/schema.ts`: Veritabanı modelleri
- `drizzle/`: Sıralı SQL migration dosyaları
- `lib/provider.ts`: SMM sağlayıcı bağlantısı
- `lib/admin-auth.ts`: Admin oturum doğrulaması
- `.openai/hosting.json`: Mevcut Cloud/Sites bağlantısı
