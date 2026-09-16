# ELTURKO SMM geliştirme talimatları

Bu proje çalışan bir SMM panelidir. Görsel marka adı ELTURKO SMM'dir. Mevcut müşteri ve admin akışlarını koruyun.

## Çalışma düzeni

1. `README.md` ve `PROJECT_STATUS.md` dosyalarını okuyun.
2. `git status` ile kullanıcı değişikliklerini kontrol edin; ilgisiz değişiklikleri silmeyin.
3. Küçük, açıklayıcı commitler kullanın. Büyük değişiklikleri ayrı branch üzerinde yapın.
4. Yeni bir ortam değişkeni eklenirse `.env.example` ve README tablosunu güncelleyin.
5. Veritabanı şeması değişirse yeni Drizzle migration üretin; eski migration dosyalarını değiştirmeyin.
6. Bitirmeden önce `pnpm build` çalıştırın.

## Güvenlik sınırları

- API anahtarları, admin şifresi, webhook sırrı ve oturum sırrı repoya yazılmaz.
- Admin yazma uçları `isAdmin()` kontrolünü korumalıdır.
- Ödeme webhooklarında imza ve mükerrer işlem koruması kaldırılmamalıdır.
- Sağlayıcıdan dönen hata metinleri sınırlanmalı ve kullanıcıya gizli değer sızdırmamalıdır.

## Para birimi

Veritabanında parasal değerler kuruş cinsinden tamsayıdır. Arayüzde TL'ye çevrilir. Float değerleri doğrudan veritabanına yazmayın.

## Yayın

Mevcut ChatGPT Sites yayını `.openai/hosting.json` içindeki proje kimliğine bağlıdır. Başka hosting kullanılacaksa bu dosyayı silmek yerine önce `docs/DEPLOYMENT.md` içindeki ayrıştırma notlarını uygulayın.
