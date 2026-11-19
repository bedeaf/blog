---
title: "Binary Ninja ile Activation Wizard Bypass'layalım"
date: 2026-11-19
draft: false
categories: ["Reversing"]
tags: ["writeup","reverse-engineering","crackme","x86","assembly"]
description: "Bu yazımızda Binary Ninja aracının kullanımına değindik ve sahte bir uygulamayı analiz ettik."
---
**Uygulamayı açalım. Bakalım bizi nasıl bir arayüz karşılayacak.**

![2026-11-19_21-20.png](/uploads/01b7f606-2026-11-19_21-20.png)

Formata uygun rastgele bir şey deneyelim şimdi

![2026-11-19_21-21.png](/uploads/d7af3a68-2026-11-19_21-21.png)

Programla iletişime geçerek toplayabileceğimiz bilgileri topladık. Daha derinlere dalalım.


![2026-11-19_21-23.png](/uploads/40ed70a8-2026-11-19_21-23.png)

Strip edilmiş bir binary'de bile import isimleri silinmez. Bu yüzden ben işleme import'lardan başlayacağım. 


![2026-11-19_21-27.png](/uploads/1b3e38de-2026-11-19_21-27.png)

Daha temiz import listesi için Triage'dan baktım. Siz soldaki semboller penceresinden de bakabilirsiniz.

![2026-11-19_21-30.png](/uploads/245091f4-2026-11-19_21-30.png)

XNextEvent'in beklediği olayı XLookupString karaktere çeviriyor bu yüzden XLookupString'in Cross Reference'ına gitmemiz lazım. Bizim için bunu X tuşu kısayolu yapıyor. Fonksiyonun adresine tıklayalım ve X'e basalım.

![2026-11-19_21-33.png](/uploads/0c047a0a-2026-11-19_21-33.png)

0x404240 adresi import kaydı, 0x401100 adresi plt stub. Sağlamasını yapmak için plt section'unun nerede başladığına bakalım.

![2026-11-19_21-36.png](/uploads/49f83f54-2026-11-19_21-36.png)

Cross Reference'dan gidip decompilerın bizim için ürettiği koda bakalım.

![2026-11-19_21-39.png](/uploads/4bba9194-2026-11-19_21-39.png)

Şimdi değişken isimlendirmelerimizi yapalım.


![2026-11-19_21-42.png](/uploads/a542e429-2026-11-19_21-42.png)

İlk dikkatimi çeken data_404120 oluyor. XLookupString'den gelen her karakter *(&data_404120 + index) = c şeklinde buraya yazılıyor ve hemen arkasından bir sonraki hücreye 0 konuyor. Karakterleri sırayla ekleyip sonuna null koyan bir şey C string'inden başka bir şey olamaz. Pencereye yazdığım parola buraya düşüyor, adını input_buf koydum.

O index'i tutan değişken data_404104 idi. Her tuşta bir artıyordu, backspace'te (0xff08) bir azalıyor, 0x7e'de de duruyor, yani 126 karakterden fazlasını kabul etmiyor. Artan, azalan ve sınırı olan bir sayaç uzunluk demek, bu yüzden adı input_len oldu.

data_404100 daha belirsizdi. Her tuş basışında 0'a çekiliyordu, Enter'a basınca ya da pencerede bir kutuya tıklayınca bir fonksiyonun dönüş değerinden hesaplanıyordu. Bunun kontrol sonucunu tuttuğunu tahmin ettim, bu yüzden genel bir isim seçtim: status. Kesin görünen ama yanlış olan bir isim beni ileride yanlış yöne götürürdü.

Fonksiyonları da tahmin yürüterek adlandırmaya devam edelim.

Fonksiyonlarda da aynı mantığı kullanıyorum. sub_4011b0, XNextEvent ile olay bekleyip tuşları işleyen döngüydü, ona event_loop dedik. Enter'a da tıklamaya da aynı fonksiyon (sub_4016b0) çağrılıyordu ve sonucu status'e gidiyor. Parolayı kontrol eden yerin orası olduğunu düşündük ve ona check dedik.
Şimdi aklımızda tutacağımız önemli noktalara gelelim.
rbx_1 = var_e8
dallanmadan geçmemiz için var_e8 yani rbx_1 = 2 olmak zorunda.

Check büyük ihtimalle 0 veya 1 döndürüyor bu noktada

status = 2 - check()

status ya 2 ya da 1 oluyor

Şimdi renklere bakarak akıl yürütelim. Yeşil renge çıkan dallanmayı bulmamız için sonucu bastıran fonksiyona(sub_401840) gidiyoruz.

![2026-11-19_22-01.png](/uploads/24554795-2026-11-19_22-01.png)

![2026-11-19_22-00.png](/uploads/1048a6f5-2026-11-19_22-00.png)

Büyük bilgiyi elde ettik. status = 2 - check() ve başarı için status == 1 gerekiyor.
Check'in döndürmesi gerektiği değeri bulmak için basit matematik kullanıyoruz.
Check = 1

Check fonksiyonuna gidelim ve hangi durumda return 1 olduğuna bakalım. G Tuşuna bastıktan sonra adresini(0x4016b0) giriyoruz.

```text
004016b5        void* fsbase
004016b5        int64_t rbx = *(fsbase + 0x28)
004016cd        int64_t rax = strlen(&input_buf)
00401707        int32_t var_48[0xe]
00401707        
00401707        if (rax == 0xe && data_404124 == 0x2d && data_404129 == 0x2d)
00401709            int64_t i = 0
0040170b            int32_t rcx_1 = 0
0040170b            
00401747            do
00401724                if (not(test_bit(0x210, i)))
00401726                    int32_t rdx_2 = sx.d(*(&input_buf + i))
00401726                    
00401731                    if (rdx_2.b - 0x30 u> 9)
00401731                        goto label_4016e1
00401731                    
00401733                    int64_t rsI_2 = sx.q(rcx_1)
00401739                    rcx_1 += 1
0040173c                    var_48[rsI_2] = rdx_2 - 0x30
0040173c                
0040173f                i += 1
00401747            while (i != 0xe)
00401747        
0040174d        uint64_t result
0040174d        
0040174d        if (rax != 0xe || data_404124 != 0x2d || data_404129 != 0x2d || var_48[0] != 7)
004016e1        label_4016e1:
004016e1            result = 0
0040174d        else
00401754            int32_t zmm1_1[0x4] = zx.o(0)
0040175d            int32_t (* i_1)[0xe] = &var_48
0040176f            int32_t zmm4_1[0x4] = data_402110
00401780            uint128_t zmm8_1 = _mm_shuffle_epi32(4, 0)
0040178f            uint128_t zmm7_1 = _mm_shuffle_epi32(9, 0)
00401798            uint128_t zmm6_1 = _mm_shuffle_epi32(0xfffffff7, 0)
0040179d            uint128_t zmm5_1 = _mm_shuffle_epi32(1, 0)
004017fe            void var_78
004017fe            
004017fe            do
004017a2                int32_t zmm3_1[0x4] = __pshufd_xmmdq_memdq_Immb(*(i_1 + 0x20), 0x1b)
004017b1                i_1 -= 0x10
004017b5                int32_t zmm11_1[0x4] = _mm_slli_epi32(zmm3_1, 1)
004017bb                int32_t zmm0_1[0x4] = zmm4_1 & zmm5_1
004017bf                zmm4_1 = _mm_add_epi32(zmm4_1, zmm8_1)
004017c9                zmm0_1 = _mm_cmpeq_epi32(zmm0_1, zx.o(0))
004017d3                int32_t zmm2_1[0x4] = _mm_cmpgt_epi32(zmm11_1, zmm7_1)
004017f7                zmm1_1 = _mm_add_epi32(zmm1_1, 
004017f7                    (not.o(zmm0_1) & ((not.o(zmm2_1) & zmm11_1)
004017f7                        | (_mm_add_epi32(zmm11_1, zmm6_1) & zmm2_1))) | (zmm3_1 & zmm0_1))
004017fe            while (&var_78 != i_1)
004017fe            
00401809            zmm1_1 = _mm_add_epi32(zmm1_1, _mm_bsrli_si128(zmm1_1, 8))
00401833            result = zx.q(ror.d(
00401833                _mm_add_epi32(zmm1_1, _mm_bsrli_si128(zmm1_1, 4))[0] * 0xcccccccd
00401833                    + 0x19999998, 
00401833                1) u<= 0x19999998)
00401833        
004016f1        if (rbx == *(fsbase + 0x28))
004016fc            return result
004016fc        
0040183b        __stack_chk_fail()
0040183b        return sub_401840() __tailcall
```
**1. Uzunluk ve tireler**

İlk if üç şeye bakıyor: strlen 14 mü, data_404124 - mi, data_404129 - mi? Bu iki adres ilk bakışta bir şey ifade etmedi. Sonra input_buf'ın 0x404120'de olduğunu hatırladık: +4 ve +9. DDDD-DDDD-DDDD'de tireler tam olarak 4. ve 9. karakterde. İlk kapı sadece formatın doğru olup olmadığına bakıyor.

**2- Rakamları Ayıklamak**

Ardından 14 karakter üzerinde dönen bir döngü geliyor. İçinde test_bit(0x210, i) var, bu da başta garip geldi. 0x210'u ikilik tabana çevirince 10 0001 0000 çıktı, yani 4. ve 9. bitler 1. Döngü tirelerin olduğu yerleri atlıyor, hepsi bu.

Kalan karakterlerin her biri için c - '0' hesaplanıyor. Sonuç 9'dan büyük çıkarsa (yani karakter rakam değilse) direkt 0 döndürülüyor. Rakamsa bir diziye yazılıyor, biz de ona digits dedik. Döngüden sonra küçük bir şart daha var: digits[0] == 7. Kod 7 ile başlamak zorunda.

**3- Checksum**

Burası en korkutucu kısımdı, çünkü derleyici -O2 ile döngüyü vektörleştirmiş, yani 4 rakamı birden işliyor. İntrinsic isimlerini ezberlemeye çalışmadık, sadece her birinin ne yaptığına baktık:

- slli 1 → sayıyı ikiyle çarpıyor
- cmpgt 9 ve add -9 → sonuç 9'dan büyükse 9 çıkarıyor
- data_402110 & 1 → bunu sadece bazı rakamlara uyguluyor
- en sonda hepsini topluyor

"Bazı rakamları ikiyle çarp ardından 9'u geçerse 9 çıkar sonra hepsini topla" görünce aklımıza kredi kartı numaralarını kontrol eden **Luhn** algoritması geldi.

Hangi rakamların ikiyle çarpıldığını bulmak için data_402110'a bakalım.


![2026-11-19_22-14.png](/uploads/88920518-2026-11-19_22-14.png)

Önceki kodumuzda en sondaki * 0xcccccccd ... <= 0x19999998 de başta sihirli sayılar gibi görünüyordu. Derleyici bölme komutu kullanmadan "bu sayı 10'a tam bölünüyor mu?" diye bu şekilde soruyormuş.

**Geçerli bir kod üretmek**

Kodu olabildiğince sade tuttuk: 7000-0000-000?. İlk rakam olan 7 ikiyle çarpılınca 14 oluyor, 9 çıkarınca 5 kalıyor. Sıfırlar toplama bir şey eklemiyor. Toplamın 10'a bölünmesi için son rakam 5 olmalı. Yani kodumuz:

7000-0000-0005

![2026-11-19_22-16.png](/uploads/d141b0fe-2026-11-19_22-16.png)

