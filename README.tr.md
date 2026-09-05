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

## Bir bulgu nereyi gösterir

Her bulgu bir satır ve bir sütun taşır. Sütun, satırın başından itibaren mantıksal sırada
sayılan, 1'den başlayan bir UTF-16 kod birimi konumudur. Editörünüzün durum çubuğunda gördüğünüz
sayı, GitHub'ın iş akışı açıklamalarında kullandığı sayı ve bir dil sunucusunun bildireceği sayı
budur; yani JSON'u okuyan bir araç, yazının hangi alfabede olduğunu bilmeden bulguya
atlayabilir.

Arapça ya da İbranice okuyan biri için bunu açıkça söylemek gerekir, çünkü mantıksal sıra gözün
gördüğü sıra değildir: sağdan sola bir satırda 12. sütundaki karakter, metnin başından itibaren
12. karakterdir ve ekranın sağ kenarına yakın çizilir, soldan 12. konumda değil. Sütunu çizim
sırasına göre saymak, bu sayıyı kullanan bütün editörleri bozar ve alfabelerin karıştığı bir
satırda yine belirsiz kalır. Bu yüzden sütun mantıksal kalıyor ve bulgu, eşleştiği metnin bir
`excerpt` parçasını da taşıyor: okumak için güvenilir olan parça alıntıdır, sütun ise oraya
atlayacak araç içindir.

## İngilizce yazmıyorsanız

Buradaki her kural İngilizce metne bakılarak yazıldı ve İngilizce metin üzerinde ölçüldü. Bu
yüzden yayına çıkmadan önce kurallar, on üç dilde doğru dizilmiş yayımlanmış metinlere karşı
çalıştırıldı: Lehçe Conan Doyle, Macarca Jókai, Rusça Çehov, Fransızca Dumas ve dokuz metin
daha; her biri kendi dilinin gerektirdiği gibi noktalanmış. Tablo
[`bench/TYPOGRAPHY.md`](bench/TYPOGRAPHY.md), derlem ve lisansları `bench/typography` içinde,
gerekçe ise [`docs/typography-across-languages.md`](docs/typography-across-languages.md)
dosyasında.

Bir kural sınıfta kaldı. `dash` bu araçtaki en yüksek şiddete sahip ve doğru yazılmış metinde
1.000 kelime başına şu oranlarda konuşuyor:

| Lehçe | Macarca | Rusça | Fransızca | Almanca | İngilizce insan temeli |
|---:|---:|---:|---:|---:|---:|
| 73,5 | 52,1 | 24,0 | 22,0 | 6,7 | 1,0 |

Lehçe, Macarca, Rusça ve Almanca sayıları, dosyaların olduğu gibi ölçülen hâli. Fransızca sayısı
tek bir kayıt istiyor ve okurun kendi bulmasına bırakmıyoruz: o dosya bize uzun tireleri, ardından
gelen kelimeye bitişik iki tire olarak yazılmış hâlde ulaşıyor, kural bunu eşleştirmiyor, yani
olduğu gibi 0, basılı baskının kullandığı tireler geri konduğunda 22,0 çıkıyor. `bench/TYPOGRAPHY.md`
iki sütunu da basıyor. Bugün bir Fransızca yazarın karşılaşacağı sayı geri konmuş olan, çünkü kimse
BENİOKU dosyasına tireyi iki tire diye yazmıyor.

Lehçe, Macarca ve Rusça dosyalar kendi dillerini doğru noktaladıkları için F alıyor. Uzun tire
Fransızcada olağandır, İspanyolcada diyaloğu açar, Rusçada ise "olmak" fiilinin yerinde durur;
yani orada süs değil dilbilgisidir.

Bu yüzden araca ne yazdığınızı söyleyin:

```json
{ "language": "tr" }
```

ya da tek çalıştırma için `--language tr`. Varsayılan İngilizcedir, yani ayarı yapmayan bir
depo için hiçbir şey değişmez. Dil İngilizce değilken `dash` çalışmaz ve çıktı bunu yazar,
sessizce temiz görünmez. Başka hiçbir kural devre dışı kalmaz, çünkü başka hiçbiri için
ölçülmüş bir gerekçe yok.

İki şeyi iddia edemez. Kuralların on beşi İngilizce kelimelerden kuruludur; İngilizce dışında
haksız değil, işlevsizdirler: tamamen bir model tarafından yazılmış Fransızca bir README
hepsini geçer, çünkü `in order to` Fransızca bir kalıp değildir. Ve bir yoğunluk eşiği `dash`
kuralını kurtarmıyor: doğru Almanca metin 1.000 kelimede 6,7 bulguda,
[`bench/PRECISION.md`](bench/PRECISION.md) içindeki makine derlemi ise 5,7'de duruyor; iki
dağılım örtüşüyor ve hiçbir genel sayı Alman bir yazarı bir modelden ayırmıyor. Bu, vazgeçmeden
önce ölçüldü.

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

## Atıf

Her sürüm Zenodo'da bir DOI ile arşivleniyor, böylece bir makale ya da rapor tam olarak
çalıştırdığı kural kümesine işaret edebiliyor. Burada bu, çoğu araçtan daha önemli: kurallar
değişiyor, yani sürümü söylenmeden verilen bir bulgu oranı tekrar edilebilir değil.

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.22396875.svg)](https://doi.org/10.5281/zenodo.22396875)

Bu **kavram** DOI'si: her zaman en yeni sürüme çözümlenir. Çalıştırdığınız sürümü atıflamak için
o sayfada yan çubuktan sürümü seçin. Depodaki `CITATION.cff` aynı tanımlayıcıyı taşıyor.

## Lisans

MIT.
