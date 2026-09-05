<p align="center"><img src="assets/wordmark.svg" width="640" alt="ai-slop-linter"></p>

<p align="center"><a href="README.md">English</a> | Türkçe</p>

<p align="center"><em>Kimin yazdığını tahmin etmez. İzleri gösterir.</em></p>

Okurlar makine yazısının izlerini öğrendi: uzun tire, "sadece X değil Y de", "umarım
yardımcı olur", "bunun kanıtıdır", her maddenin başındaki kalın etiket. Birini gördükleri
anda okumayı bırakıyorlar. ai-slop-linter bu izler için bir linter. Bir commit mesajına,
bir pull request açıklamasına, bir README'ye veya bir makaleye çevirirsiniz; her izi satır
numarasıyla, gerekçesiyle ve anlamı değiştirmeyecekse düzeltmesiyle listeler.

Bir linter, dedektör değil. Metni bir modelin yazdığına dair olasılık üretmez. Her kural
kaynağını söyler; temiz geçmek tek bir anlama gelir: listedeki izlerden hiçbiri yok.

## 30 saniye

```
npx ai-slop-linter README.md          # tek dosya (hata varsa çıkış kodu 1)
npx ai-slop-linter                    # bulunduğunuz dizindeki her .md dosyası
npx ai-slop-linter --commit           # son commit mesajı
npx ai-slop-linter README.md --fix    # güvenli düzeltmeleri yerinde uygula
```

`slop` aynı ikili dosyanın kısa adı.

## Kurallar

Yirmi kural. Çoğu, binlerce makine yazımı düzenlemeyi inceleyen editörlerin yazdığı
Wikipedia yönergesinden geliyor: [Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing).
"house" işaretli ikisi bizim. Tam liste ve kaynaklar için `npx ai-slop-linter --rules`
veya İngilizce README'deki tablo.

- error (her zaman yanlış, çalıştırmayı düşürür): uzun tire, sohbet botu kalıntısı
  ("Umarım yardımcı olur"), bilgi kesim tarihi uyarısı.
- warning (cümleyi yeniden yazın): "sadece X değil Y", zorlama üçlemeler, "asıl
  soru şu", virgülden sonra gelen "-arak/-erek" kuyruğu, şişirilmiş önem, yapay zekâ
  kelime dağarcığı, reklam dili, belirsiz kaynak, giriş anonsu, boş olumlu kapanış,
  liste maddesinde kalın etiket, süs emojisi.
- info (fırsat bulunca): dolgu ifadeler, kıvrımlı tırnak, Her Kelimesi Büyük Başlık,
  kalıp "zorluklar ve gelecek" bölümü, tireli bileşik yoğunluğu.

Kod blokları, satır içi kod, front matter, bağlantı hedefleri, URL'ler ve HTML
kurallardan önce maskelenir; kod örneğindeki bir tire asla bulgu olmaz.

Yanlış bulduğunuz bir uyarıyı susturmak için:

```markdown
<!-- slop-ignore-next-line dash -->
<!-- slop-ignore vague-source, triad -->    (buradan dosya sonuna kadar)
```

## Depoda

Pull request'lerde Action, başlığı, açıklamayı ve değişen her Markdown dosyasını lint
eder, diff üzerine satır satır not düşer ve pull request'in altında her push'ta
güncellenen tek bir bulgu tablosu tutar (`pull-requests: write` ister; `comment: "false"`
ile yalnızca notlar kalır):

```yaml
- uses: Bubblegunn/ai-slop-linter@v0
```

Geçmişi olan bir depoda `--baseline-write` bugünkü bulguları kaydeder, `--baseline` yalnızca
yenilere takılır; önce temizlik commit'i gerekmez.

Commit mesajları için bir `commit-msg` kancası:

```
curl -fsSL https://raw.githubusercontent.com/Bubblegunn/ai-slop-linter/main/scripts/install-hook.sh | sh
```

commitlint kullananlar için aynı kural bir eklenti olarak var:
`extends: ["ai-slop-linter/commitlint/config"]`. VS Code'da `.vscode/tasks.json` içindeki
görev, bulguları Sorunlar paneline ve metnin içine taşır.

Ajanlar için skill, ajanın commit mesajını veya PR açıklamasını teslim etmeden önce
kendi metnini lint etmesini sağlar:

```
npx skills add Bubblegunn/ai-slop-linter
```

## Ölçüm

Bir linter boş yere uyarırsa kaldırılır, o yüzden yanlış uyarı maliyeti iddia değil ölçüm
olarak duruyor. `bench/corpus` içinde on metin var: dil modelleri ortaya çıkmadan önce yazılmış
beş metin (Austen 1813, Douglass 1845, Darwin 1859, PEP 8 ve PEP 257) ve düzeltilmemiş beş model
çıktısı. `npm run bench` her kuralı ikisinin üzerinde çalıştırıp
[`bench/PRECISION.md`](bench/PRECISION.md) dosyasını yazar; tablo eskirse CI kırılır.

İnsan metinleri A veya B alıyor, model çıktıları F. İlk koşu bir kuralın hatalı olduğunu
gösterdi: `curly-quotes` *Pride and Prejudice* bölümünde 92 satır işaretliyordu, model
çıktısında ise hiç. Kıvrık tırnak tipografidir; asıl iz, dosyanın kıvrık ve düz tırnağı
karıştırmasıdır. Kural artık yalnızca karışık dosyada konuşuyor.

## Bunu neden yaptığını anlat

`slop --explain <kural>` bir kuralı dört parçayla anlatır: neden makine izi sayılır, kuralı
tetikleyen bir satır, aynı satırın düzeltilmiş hali ve kuralı kapatmanın doğru olduğu durum.
`slop --init` başlangıç `.slop.json` dosyasını, `--init action` CI tanımını, `--init hook`
commit kancasını yazar. `.slop.json` içindeki `overrides` ile her yol için ayrı kural ve puan
sınırı verilebilir.

## Kendi yazılarımızda

5 Eylül 2026'da yazarın dört README'si ve sitesindeki on bir denemede çalıştırıldı:
ilk koşuda üç README A, product-engineer README C (kural listesi tam olarak `bold-label`
kuralının yakaladığı kalıpta yazılmıştı), on bir denemenin tümü A. Aynı gün o README
aracı önce gösterip sonra anlatacak biçimde yeniden yazıldı ve kural listesi düz cümleye
döndü; linter için düzenlenmedi, yeni koşuda A (0). Bulgular ve ilk skorlar İngilizce
README'deki tabloda.

## Gösteremedikleri

- Yazarlık. `Delve` yazan bir insan da modelle aynı bulguyu alır.
- Anlam. Listedeki her ifadeden kaçınan boş bir paragrafı iyisinden ayıramaz.
- Listenin dışındaki üslup. Farklı bir izi olan yazar geçer; bulunca kural ekleyin.
- Diğer diller. Kelime kuralları İngilizce; yapısal olanlar her dilde çalışır.
  İkinci dil kural setleri [yol haritasında](ROADMAP.md).

## Lisans

MIT.
