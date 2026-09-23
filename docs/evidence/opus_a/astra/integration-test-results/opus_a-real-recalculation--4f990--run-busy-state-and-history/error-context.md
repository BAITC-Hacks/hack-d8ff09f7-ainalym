# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: opus_a.spec.ts >> real recalculation: complete run, busy state and history
- Location: tests/e2e/opus_a.spec.ts:151:5

# Error details

```
Error: apiRequestContext.get: read ECONNRESET
Call log:
  - → GET http://localhost:3111/api/calc/runs
    - user-agent: Playwright/1.63.0 (arm64; macOS 26.4) node/24.18
    - accept: */*
    - accept-encoding: gzip,deflate,br

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - link "К содержимому" [ref=e3] [cursor=pointer]:
      - /url: "#main"
    - complementary "Разделы" [ref=e4]:
      - link "Ainalym" [ref=e5] [cursor=pointer]:
        - /url: /opus_a/today
      - navigation [ref=e6]:
        - link "Сегодня 11" [ref=e7] [cursor=pointer]:
          - /url: /opus_a/today
          - generic [ref=e11]: Сегодня
          - generic "11 ждут вашего решения" [ref=e12]: "11"
        - link "Пополнение 636" [ref=e13] [cursor=pointer]:
          - /url: /opus_a/replenishment
          - generic [ref=e18]: Пополнение
          - generic "636 SKU под риском дефицита" [ref=e19]: "636"
        - link "Товар" [ref=e20] [cursor=pointer]:
          - /url: /opus_a/skus/130200122_
        - link "Основной интерфейс" [ref=e29] [cursor=pointer]:
          - /url: /today
      - generic [ref=e35]:
        - status [ref=e36]: Синхронизация включена
        - generic [ref=e38]: Данные партнёра · обезличены
    - generic [ref=e39]:
      - banner [ref=e40]:
        - generic [ref=e42]:
          - generic [aria-hidden] [ref=e46]: ⌘
          - generic [aria-hidden] [ref=e47]: K
          - combobox "Поиск товара" [ref=e48]
      - main [ref=e49]:
        - generic [ref=e50]:
          - generic [ref=e51]:
            - generic [ref=e52]:
              - link "Сегодня" [ref=e53] [cursor=pointer]:
                - /url: /opus_a/today
              - text: / Закупки
            - heading "Пополнение" [level=1] [ref=e54]
          - link "К решениям" [ref=e56] [cursor=pointer]:
            - /url: /opus_a/today
        - generic [ref=e59]:
          - paragraph [ref=e60]: Проверьте количества. Откройте товар, чтобы увидеть расчёт.
          - generic "Источник, AI, внешнее действие" [ref=e62]:
            - generic "provenance=partner_anonymised" [ref=e63]: Данные партнёра · обезличены
            - generic "ai=replay" [ref=e64]: Воспроизведение · записанное решение
            - generic "external=export_only" [ref=e65]: Экспорт для 1С (файл)
          - generic [ref=e66]:
            - generic [ref=e67]:
              - generic [ref=e68]:
                - text: "Последний расчёт:"
                - time [ref=e69]: 23 сент., 03:59
              - button "Пересчитать всё" [ref=e70] [cursor=pointer]
              - group [ref=e76]:
                - generic "История расчётов" [ref=e77] [cursor=pointer]
            - status [ref=e78]:
              - strong [ref=e83]: "Расчёт готов: 1 259 рекомендаций."
        - tablist "Срочность" [ref=e84]:
          - tab "Все 294" [selected] [ref=e85] [cursor=pointer]:
            - text: Все
            - generic [ref=e86]: "294"
          - tab "Критично 58" [ref=e87] [cursor=pointer]:
            - text: Критично
            - generic [ref=e88]: "58"
          - tab "Скоро 83" [ref=e89] [cursor=pointer]:
            - text: Скоро
            - generic [ref=e90]: "83"
          - tab "Планово 153" [ref=e91] [cursor=pointer]:
            - text: Планово
            - generic [ref=e92]: "153"
        - generic [ref=e93]:
          - textbox "Фильтр по названию или коду 1С" [ref=e98]
          - navigation "Поставщик" [ref=e99]:
            - link "Все поставщики" [ref=e100] [cursor=pointer]:
              - /url: /opus_a/replenishment
            - link "IEK" [ref=e101] [cursor=pointer]:
              - /url: /opus_a/replenishment?supplier=IEK
            - link "SE" [ref=e102] [cursor=pointer]:
              - /url: /opus_a/replenishment?supplier=SE
          - generic [ref=e103]: "↑ ↓ / j k · Enter: расчёт · Esc: свернуть"
        - tabpanel "Все 294" [ref=e104]:
          - region "Поставщик SE" [ref=e105]:
            - generic [ref=e106]:
              - heading "SE" [level=2] [ref=e107]
              - generic [ref=e108]: 294 из 294 позиций
              - generic [ref=e110]:
                - strong [ref=e111]: 67 763 248 ₸
                - text: весь заказ
                - generic [ref=e112]: цена известна для 262 из 294
            - table [ref=e114]:
              - rowgroup [ref=e115]:
                - row [ref=e116]:
                  - columnheader "Товар" [ref=e117]
                  - columnheader "Срочность" [ref=e118]
                  - columnheader "Прогноз" [ref=e119]
                  - columnheader "Остаток" [ref=e120]
                  - columnheader "В пути" [ref=e121]
                  - columnheader "Страх. запас" [ref=e122]
                  - columnheader "Кратность" [ref=e123]
                  - columnheader "К заказу, шт" [ref=e124]
                  - columnheader "Стоимость" [ref=e125]
              - rowgroup [ref=e126]:
                - row [ref=e127]:
                  - cell [ref=e128]:
                    - button "S247 4-я.о/у.з/к.з/ш 16А IP20 \"Прима\" РА 16-411М-б (22) !!! 030200075_ · покрытие 0 дн" [ref=e129] [cursor=pointer]:
                      - generic [ref=e133]:
                        - generic [ref=e134]: S247 4-я.о/у.з/к.з/ш 16А IP20 "Прима" РА 16-411М-б (22) !!!
                        - generic [ref=e135]: 030200075_ · покрытие 0 дн
                  - cell "критично" [ref=e136]
                  - cell "842" [ref=e140]
                  - cell "0" [ref=e141]
                  - cell "0" [ref=e142]
                  - cell "191" [ref=e143]
                  - cell "1" [ref=e144]
                  - cell "1 034" [ref=e145]
                  - cell "4 260 649 ₸" [ref=e146]
                - row [ref=e147]:
                  - cell [ref=e148]:
                    - button "S417 Роз 2-ная с/у без з/к 16А 250В \"BLANCA\" белый BLNRS000021 (36) 300200316_ · покрытие 0 дн" [ref=e149] [cursor=pointer]:
                      - generic [ref=e153]:
                        - generic [ref=e154]: S417 Роз 2-ная с/у без з/к 16А 250В "BLANCA" белый BLNRS000021 (36)
                        - generic [ref=e155]: 300200316_ · покрытие 0 дн
                  - cell "критично" [ref=e156]
                  - cell "54" [ref=e160]
                  - cell "0" [ref=e161]
                  - cell "0" [ref=e162]
                  - cell "66" [ref=e163]
                  - cell "6" [ref=e164]
                  - cell "126" [ref=e165]
                  - cell "106 651 ₸" [ref=e166]
                - row [ref=e167]:
                  - cell [ref=e168]:
                    - button "K025 Выкл 1 кл с инд 10А с/у б/рамки \"ATLAS\" ШАМПАНЬ ATN513 (10) 300200544_ · покрытие 0 дн" [ref=e169] [cursor=pointer]:
                      - generic [ref=e173]:
                        - generic [ref=e174]: K025 Выкл 1 кл с инд 10А с/у б/рамки "ATLAS" ШАМПАНЬ ATN513 (10)
                        - generic [ref=e175]: 300200544_ · покрытие 0 дн
                  - cell "критично" [ref=e176]
                  - cell "31" [ref=e180]
                  - cell "0" [ref=e181]
                  - cell "0" [ref=e182]
                  - cell "12" [ref=e183]
                  - cell "10" [ref=e184]
                  - cell "50" [ref=e185]
                  - cell "95 570 ₸" [ref=e186]
                - row [ref=e187]:
                  - cell [ref=e188]:
                    - button "K027 Выкл 2 кл с инд 10А с/у б/рамки \"ATLAS\" ШАМПАНЬ ATN553 (10) 300200546_ · покрытие 0 дн" [ref=e189] [cursor=pointer]:
                      - generic [ref=e193]:
                        - generic [ref=e194]: K027 Выкл 2 кл с инд 10А с/у б/рамки "ATLAS" ШАМПАНЬ ATN553 (10)
                        - generic [ref=e195]: 300200546_ · покрытие 0 дн
                  - cell "критично" [ref=e196]
                  - cell "13" [ref=e200]
                  - cell "0" [ref=e201]
                  - cell "0" [ref=e202]
                  - cell "9" [ref=e203]
                  - cell "10" [ref=e204]
                  - cell "30" [ref=e205]
                  - cell "46 452 ₸" [ref=e206]
                - row [ref=e207]:
                  - cell [ref=e208]:
                    - button "К104 Роз. с з/к 16А с/у з/ш ATLAS ПЕСОЧНЫЙ ATN1244 (5) 300200732_ · покрытие 0 дн" [ref=e209] [cursor=pointer]:
                      - generic [ref=e213]:
                        - generic [ref=e214]: К104 Роз. с з/к 16А с/у з/ш ATLAS ПЕСОЧНЫЙ ATN1244 (5)
                        - generic [ref=e215]: 300200732_ · покрытие 0 дн
                  - cell "критично" [ref=e216]
                  - cell "27" [ref=e220]
                  - cell "0" [ref=e221]
                  - cell "0" [ref=e222]
                  - cell "20" [ref=e223]
                  - cell "5" [ref=e224]
                  - cell "50" [ref=e225]
                  - cell "65 796 ₸" [ref=e226]
                - row [ref=e227]:
                  - cell [ref=e228]:
                    - button "К116 Роз,Выкл.2-кл з/к з/ш IP54 16А Alas Profi 54 БЕЛЫЙ ATN540174 (6) 300200747_ · покрытие 0 дн" [ref=e229] [cursor=pointer]:
                      - generic [ref=e233]:
                        - generic [ref=e234]: К116 Роз,Выкл.2-кл з/к з/ш IP54 16А Alas Profi 54 БЕЛЫЙ ATN540174 (6)
                        - generic [ref=e235]: 300200747_ · покрытие 0 дн
                  - cell "критично" [ref=e236]
                  - cell "2" [ref=e240]
                  - cell "0" [ref=e241]
                  - cell "0" [ref=e242]
                  - cell "6" [ref=e243]
                  - cell "6" [ref=e244]
                  - cell "12" [ref=e245]
                  - cell "28 212 ₸" [ref=e246]
                - row [ref=e247]:
                  - cell [ref=e248]:
                    - button "S415 Адаптер 45 \"ATLAS\" белый ATN108 (15) ATN000108 · покрытие 0 дн" [ref=e249] [cursor=pointer]:
                      - generic [ref=e253]:
                        - generic [ref=e254]: S415 Адаптер 45 "ATLAS" белый ATN108 (15)
                        - generic [ref=e255]: ATN000108 · покрытие 0 дн
                  - cell "критично" [ref=e256]
                  - cell "5" [ref=e260]
                  - cell "0" [ref=e261]
                  - cell "0" [ref=e262]
                  - cell "21" [ref=e263]
                  - cell "5" [ref=e264]
                  - cell "30" [ref=e265]
                  - cell "7 811 ₸" [ref=e266]
                - row [ref=e267]:
                  - cell [ref=e268]:
                    - button "S259 2-я. о/у.з/к.16А IP20 \"ХИТ\" РА 16-238I-б (84) !!! 030200240_ · покрытие 0,3 дн" [ref=e269] [cursor=pointer]:
                      - generic [ref=e273]:
                        - generic [ref=e274]: S259 2-я. о/у.з/к.16А IP20 "ХИТ" РА 16-238I-б (84) !!!
                        - generic [ref=e275]: 030200240_ · покрытие 0,3 дн
                  - cell "критично" [ref=e276]
                  - cell "235" [ref=e280]
                  - cell "1" [ref=e281]
                  - cell "0" [ref=e282]
                  - cell "235" [ref=e283]
                  - cell "16" [ref=e284]
                  - cell "480" [ref=e285]
                  - cell "себестоимость не задана" [ref=e286]
                - row [ref=e288]:
                  - cell [ref=e289]:
                    - button "S252 2-я с/у 10А IP20 \"ХИТ\" РС 16-235-б / 16-230-б (80) !!! 030200037_ · покрытие 0,5 дн" [ref=e290] [cursor=pointer]:
                      - generic [ref=e294]:
                        - generic [ref=e295]: S252 2-я с/у 10А IP20 "ХИТ" РС 16-235-б / 16-230-б (80) !!!
                        - generic [ref=e296]: 030200037_ · покрытие 0,5 дн
                  - cell "критично" [ref=e297]
                  - cell "183" [ref=e301]
                  - cell "1" [ref=e302]
                  - cell "0" [ref=e303]
                  - cell "151" [ref=e304]
                  - cell "10" [ref=e305]
                  - cell "340" [ref=e306]
                  - cell "себестоимость не задана" [ref=e307]
                - row [ref=e309]:
                  - cell [ref=e310]:
                    - button "AtlasDesign Розетка 1я бел. с з/к со штор. 16А, механизм, ATN000145 !!! 300200458_ · покрытие 0,7 дн" [ref=e311] [cursor=pointer]:
                      - generic [ref=e315]:
                        - generic [ref=e316]: AtlasDesign Розетка 1я бел. с з/к со штор. 16А, механизм, ATN000145 !!!
                        - generic [ref=e317]: 300200458_ · покрытие 0,7 дн
                  - cell "критично" [ref=e318]
                  - cell "260" [ref=e322]
                  - cell "2" [ref=e323]
                  - cell "0" [ref=e324]
                  - cell "41" [ref=e325]
                  - cell "1" [ref=e326]
                  - cell "300" [ref=e327]
                  - cell "себестоимость не задана" [ref=e328]
                - row [ref=e330]:
                  - cell [ref=e331]:
                    - button "S254 о/у. 6А IP20 \"ХИТ\" ВА 16-131-б (168) !!! 030200028_ · покрытие 0,8 дн" [ref=e332] [cursor=pointer]:
                      - generic [ref=e336]:
                        - generic [ref=e337]: S254 о/у. 6А IP20 "ХИТ" ВА 16-131-б (168) !!!
                        - generic [ref=e338]: 030200028_ · покрытие 0,8 дн
                  - cell "критично" [ref=e339]
                  - cell "175" [ref=e343]
                  - cell "1" [ref=e344]
                  - cell "0" [ref=e345]
                  - cell "100" [ref=e346]
                  - cell "25" [ref=e347]
                  - cell "275" [ref=e348]
                  - cell "себестоимость не задана" [ref=e349]
                - row [ref=e351]:
                  - cell [ref=e352]:
                    - button "Сжим У 734М (16-35/16-25) Sch El (140) 130300028_ · покрытие 0,8 дн" [ref=e353] [cursor=pointer]:
                      - generic [ref=e357]:
                        - generic [ref=e358]: Сжим У 734М (16-35/16-25) Sch El (140)
                        - generic [ref=e359]: 130300028_ · покрытие 0,8 дн
                  - cell "критично" [ref=e360]
                  - cell "692" [ref=e364]
                  - cell "8" [ref=e365]
                  - cell "0" [ref=e366]
                  - cell "487" [ref=e367]
                  - cell "140" [ref=e368]
                  - cell "1 260" [ref=e369]
                  - cell "391 621 ₸" [ref=e370]
                - row [ref=e371]:
                  - cell [ref=e372]:
                    - button "S258 2-я.о/у. 10А IP20 \"ХИТ\" РА 16-237I-б / РА 16-233I-б (112) !!! 030200239_ · покрытие 0,9 дн" [ref=e373] [cursor=pointer]:
                      - generic [ref=e377]:
                        - generic [ref=e378]: S258 2-я.о/у. 10А IP20 "ХИТ" РА 16-237I-б / РА 16-233I-б (112) !!!
                        - generic [ref=e379]: 030200239_ · покрытие 0,9 дн
                  - cell "критично" [ref=e380]
                  - cell "109" [ref=e384]
                  - cell "1" [ref=e385]
                  - cell "0" [ref=e386]
                  - cell "99" [ref=e387]
                  - cell "16" [ref=e388]
                  - cell "208" [ref=e389]
                  - cell "себестоимость не задана" [ref=e390]
                - row [ref=e392]:
                  - cell [ref=e393]:
                    - button "Роз. двойная с з/к, 16А, в сборе, карбон \"ATLAS\" 300200469_ · покрытие 1,1 дн" [ref=e394] [cursor=pointer]:
                      - generic [ref=e398]:
                        - generic [ref=e399]: Роз. двойная с з/к, 16А, в сборе, карбон "ATLAS"
                        - generic [ref=e400]: 300200469_ · покрытие 1,1 дн
                  - cell "критично" [ref=e401]
                  - cell "80" [ref=e405]
                  - cell "1" [ref=e406]
                  - cell "0" [ref=e407]
                  - cell "18" [ref=e408]
                  - cell "1" [ref=e409]
                  - cell "97" [ref=e410]
                  - cell "себестоимость не задана" [ref=e411]
                - row [ref=e413]:
                  - cell [ref=e414]:
                    - button "Распределительная коробка с/у для твердых стен 75х30 карболит IP30 У-195 Systeme Electric (108) 030300013_ · покрытие 3,3 дн" [ref=e415] [cursor=pointer]:
                      - generic [ref=e419]:
                        - generic [ref=e420]: Распределительная коробка с/у для твердых стен 75х30 карболит IP30 У-195 Systeme Electric (108)
                        - generic [ref=e421]: 030300013_ · покрытие 3,3 дн
                  - cell "критично" [ref=e422]
                  - cell "14" [ref=e426]
                  - cell "1" [ref=e427]
                  - cell "0" [ref=e428]
                  - cell "57" [ref=e429]
                  - cell "108" [ref=e430]
                  - cell "108" [ref=e431]
                  - cell "себестоимость не задана" [ref=e432]
                - row [ref=e434]:
                  - cell [ref=e435]:
                    - button "S360 Выкл 1 кл 10А с/у \"GLOSSA\" белый GSL112 (15) 030200247_ · покрытие 3,8 дн" [ref=e436] [cursor=pointer]:
                      - generic [ref=e440]:
                        - generic [ref=e441]: S360 Выкл 1 кл 10А с/у "GLOSSA" белый GSL112 (15)
                        - generic [ref=e442]: 030200247_ · покрытие 3,8 дн
                  - cell "критично" [ref=e443]
                  - cell "17" [ref=e447]
                  - cell "1" [ref=e448]
                  - cell "0" [ref=e449]
                  - cell "36" [ref=e450]
                  - cell "15" [ref=e451]
                  - cell "60" [ref=e452]
                  - cell "себестоимость не задана" [ref=e453]
                - row [ref=e455]:
                  - cell [ref=e456]:
                    - button "S369 Роз. с з/к 16А с/у \"GLOSSA\" белый GSL142 (15) 030200256_ · покрытие 4,1 дн" [ref=e457] [cursor=pointer]:
                      - generic [ref=e461]:
                        - generic [ref=e462]: S369 Роз. с з/к 16А с/у "GLOSSA" белый GSL142 (15)
                        - generic [ref=e463]: 030200256_ · покрытие 4,1 дн
                  - cell "критично" [ref=e464]
                  - cell "92" [ref=e468]
                  - cell "3" [ref=e469]
                  - cell "0" [ref=e470]
                  - cell "96" [ref=e471]
                  - cell "15" [ref=e472]
                  - cell "195" [ref=e473]
                  - cell "себестоимость не задана" [ref=e474]
                - row [ref=e476]:
                  - cell [ref=e477]:
                    - button "K062 Рамка 2-ная \"ATLAS\" ГРИФЕЛЬ ATN702 (10) 300200580_ · покрытие 5,6 дн" [ref=e478] [cursor=pointer]:
                      - generic [ref=e482]:
                        - generic [ref=e483]: K062 Рамка 2-ная "ATLAS" ГРИФЕЛЬ ATN702 (10)
                        - generic [ref=e484]: 300200580_ · покрытие 5,6 дн
                  - cell "критично" [ref=e485]
                  - cell "68" [ref=e489]
                  - cell "4" [ref=e490]
                  - cell "0" [ref=e491]
                  - cell "34" [ref=e492]
                  - cell "10" [ref=e493]
                  - cell "100" [ref=e494]
                  - cell "110 068 ₸" [ref=e495]
                - row [ref=e496]:
                  - cell [ref=e497]:
                    - button "S187 с/у. з/ш. з/к.16А \"Wessen 59\" РС 16-152-18 (10/60) !!! 030200093_ · покрытие 5,7 дн" [ref=e498] [cursor=pointer]:
                      - generic [ref=e502]:
                        - generic [ref=e503]: S187 с/у. з/ш. з/к.16А "Wessen 59" РС 16-152-18 (10/60) !!!
                        - generic [ref=e504]: 030200093_ · покрытие 5,7 дн
                  - cell "критично" [ref=e505]
                  - cell "42" [ref=e509]
                  - cell "3" [ref=e510]
                  - cell "0" [ref=e511]
                  - cell "59" [ref=e512]
                  - cell "20" [ref=e513]
                  - cell "100" [ref=e514]
                  - cell "себестоимость не задана" [ref=e515]
                - row [ref=e517]:
                  - cell [ref=e518]:
                    - button "S366 Переключ. 1 кл с инд 10А с/у б/рамки \"GLOSSA\" белый GSL163 (20) 030200249_ · покрытие 6,5 дн" [ref=e519] [cursor=pointer]:
                      - generic [ref=e523]:
                        - generic [ref=e524]: S366 Переключ. 1 кл с инд 10А с/у б/рамки "GLOSSA" белый GSL163 (20)
                        - generic [ref=e525]: 030200249_ · покрытие 6,5 дн
                  - cell "критично" [ref=e526]
                  - cell "17" [ref=e530]
                  - cell "1" [ref=e531]
                  - cell "0" [ref=e532]
                  - cell "8" [ref=e533]
                  - cell "20" [ref=e534]
                  - cell "40" [ref=e535]
                  - cell "себестоимость не задана" [ref=e536]
                - row [ref=e538]:
                  - cell [ref=e539]:
                    - button "S283 о/у. 6А IP44 \"Рондо\" ВА 66-102Б-би переключатель (10/60) !!! 030200026_ · покрытие 7,9 дн" [ref=e540] [cursor=pointer]:
                      - generic [ref=e544]:
                        - generic [ref=e545]: S283 о/у. 6А IP44 "Рондо" ВА 66-102Б-би переключатель (10/60) !!!
                        - generic [ref=e546]: 030200026_ · покрытие 7,9 дн
                  - cell "критично" [ref=e547]
                  - cell "45" [ref=e551]
                  - cell "4" [ref=e552]
                  - cell "0" [ref=e553]
                  - cell "90" [ref=e554]
                  - cell "1" [ref=e555]
                  - cell "132" [ref=e556]
                  - cell "себестоимость не задана" [ref=e557]
                - row [ref=e559]:
                  - cell [ref=e560]:
                    - button "G391 Переключ. 1 кл 10А с/у б/рамки \"ATLAS\" жемчуг ATN461 (10) 300200367_ · покрытие 8,8 дн" [ref=e561] [cursor=pointer]:
                      - generic [ref=e565]:
                        - generic [ref=e566]: G391 Переключ. 1 кл 10А с/у б/рамки "ATLAS" жемчуг ATN461 (10)
                        - generic [ref=e567]: 300200367_ · покрытие 8,8 дн
                  - cell "критично" [ref=e568]
                  - cell "7" [ref=e572]
                  - cell "2" [ref=e573]
                  - cell "0" [ref=e574]
                  - cell "24" [ref=e575]
                  - cell "10" [ref=e576]
                  - cell "30" [ref=e577]
                  - cell "38 805 ₸" [ref=e578]
                - row [ref=e579]:
                  - cell [ref=e580]:
                    - button "Сжим У 733M (16-35/1,5-10) Sch El (140) 130300027_ · покрытие 12,5 дн" [ref=e581] [cursor=pointer]:
                      - generic [ref=e585]:
                        - generic [ref=e586]: Сжим У 733M (16-35/1,5-10) Sch El (140)
                        - generic [ref=e587]: 130300027_ · покрытие 12,5 дн
                  - cell "критично" [ref=e588]
                  - cell "557" [ref=e592]
                  - cell "108" [ref=e593]
                  - cell "0" [ref=e594]
                  - cell "930" [ref=e595]
                  - cell "140" [ref=e596]
                  - cell "1 400" [ref=e597]
                  - cell "457 156 ₸" [ref=e598]
                - row [ref=e599]:
                  - cell [ref=e600]:
                    - button "S284 2кл. о/у 6А IP44 \"Рондо\" ВА 56-225Б-би (10/60) !!! 030200025_ · покрытие 14,1 дн" [ref=e601] [cursor=pointer]:
                      - generic [ref=e605]:
                        - generic [ref=e606]: S284 2кл. о/у 6А IP44 "Рондо" ВА 56-225Б-би (10/60) !!!
                        - generic [ref=e607]: 030200025_ · покрытие 14,1 дн
                  - cell "критично" [ref=e608]
                  - cell "6" [ref=e612]
                  - cell "1" [ref=e613]
                  - cell "0" [ref=e614]
                  - cell "18" [ref=e615]
                  - cell "1" [ref=e616]
                  - cell "23" [ref=e617]
                  - cell "себестоимость не задана" [ref=e618]
                - row [ref=e620]:
                  - cell [ref=e621]:
                    - button "K063 Рамка 3-ная \"ATLAS\" ГРИФЕЛЬ ATN703 (15) 300200581_ · покрытие 15 дн" [ref=e622] [cursor=pointer]:
                      - generic [ref=e626]:
                        - generic [ref=e627]: K063 Рамка 3-ная "ATLAS" ГРИФЕЛЬ ATN703 (15)
                        - generic [ref=e628]: 300200581_ · покрытие 15 дн
                  - cell "критично" [ref=e629]
                  - cell "59" [ref=e633]
                  - cell "10" [ref=e634]
                  - cell "0" [ref=e635]
                  - cell "17" [ref=e636]
                  - cell "5" [ref=e637]
                  - cell "70" [ref=e638]
                  - cell "131 812 ₸" [ref=e639]
                - row [ref=e640]:
                  - cell [ref=e641]:
                    - button "S315 Розетка 1-я о/у, з/ш, з/к IP44 Белая ЭТЮД РА16-044В (96) 030200176_ · покрытие 15,1 дн" [ref=e642] [cursor=pointer]:
                      - generic [ref=e646]:
                        - generic [ref=e647]: S315 Розетка 1-я о/у, з/ш, з/к IP44 Белая ЭТЮД РА16-044В (96)
                        - generic [ref=e648]: 030200176_ · покрытие 15,1 дн
                  - cell "критично" [ref=e649]
                  - cell "8" [ref=e653]
                  - cell "1" [ref=e654]
                  - cell "0" [ref=e655]
                  - cell "17" [ref=e656]
                  - cell "12" [ref=e657]
                  - cell "24" [ref=e658]
                  - cell "себестоимость не задана" [ref=e659]
                - row [ref=e661]:
                  - cell [ref=e662]:
                    - button "S186 с/у. з/ш 16А \"Wessen 59\" РС 16-151-18 (10/60) !!! 030200072_ · покрытие 19,4 дн" [ref=e663] [cursor=pointer]:
                      - generic [ref=e667]:
                        - generic [ref=e668]: S186 с/у. з/ш 16А "Wessen 59" РС 16-151-18 (10/60) !!!
                        - generic [ref=e669]: 030200072_ · покрытие 19,4 дн
                  - cell "критично" [ref=e670]
                  - cell "20" [ref=e674]
                  - cell "3" [ref=e675]
                  - cell "0" [ref=e676]
                  - cell "31" [ref=e677]
                  - cell "1" [ref=e678]
                  - cell "48" [ref=e679]
                  - cell "себестоимость не задана" [ref=e680]
                - row [ref=e682]:
                  - cell [ref=e683]:
                    - button "S380 Рамка 2-ная \"GLOSSA\" белый GSL102 (30) 030200251_ · покрытие 19,4 дн" [ref=e684] [cursor=pointer]:
                      - generic [ref=e688]:
                        - generic [ref=e689]: S380 Рамка 2-ная "GLOSSA" белый GSL102 (30)
                        - generic [ref=e690]: 030200251_ · покрытие 19,4 дн
                  - cell "критично" [ref=e691]
                  - cell "54" [ref=e695]
                  - cell "11" [ref=e696]
                  - cell "0" [ref=e697]
                  - cell "43" [ref=e698]
                  - cell "30" [ref=e699]
                  - cell "90" [ref=e700]
                  - cell "себестоимость не задана" [ref=e701]
                - row [ref=e703]:
                  - cell [ref=e704]:
                    - button "S379 Рамка 1-ная \"GLOSSA\" белый GSL101 (45) 030200250_ · покрытие 20,6 дн" [ref=e705] [cursor=pointer]:
                      - generic [ref=e709]:
                        - generic [ref=e710]: S379 Рамка 1-ная "GLOSSA" белый GSL101 (45)
                        - generic [ref=e711]: 030200250_ · покрытие 20,6 дн
                  - cell "критично" [ref=e712]
                  - cell "52" [ref=e716]
                  - cell "11" [ref=e717]
                  - cell "0" [ref=e718]
                  - cell "25" [ref=e719]
                  - cell "45" [ref=e720]
                  - cell "90" [ref=e721]
                  - cell "себестоимость не задана" [ref=e722]
                - row [ref=e724]:
                  - cell [ref=e725]:
                    - button "K012 Роз. 2-ная с/у 16А с з/к з/ш \"ATLAS\" СТАЛЬ ATN926 (6) 300200531_ · покрытие 23 дн" [ref=e726] [cursor=pointer]:
                      - generic [ref=e730]:
                        - generic [ref=e731]: K012 Роз. 2-ная с/у 16А с з/к з/ш "ATLAS" СТАЛЬ ATN926 (6)
                        - generic [ref=e732]: 300200531_ · покрытие 23 дн
                  - cell "критично" [ref=e733]
                  - cell "68" [ref=e737]
                  - cell "8" [ref=e738]
                  - cell "0" [ref=e739]
                  - cell "17" [ref=e740]
                  - cell "6" [ref=e741]
                  - cell "78" [ref=e742]
                  - cell "308 979 ₸" [ref=e743]
                - row [ref=e744]:
                  - cell [ref=e745]:
                    - button "Сжим У 731М (4-10/1,5-10) Sch El (140) 130300026_ · покрытие 25,2 дн" [ref=e746] [cursor=pointer]:
                      - generic [ref=e750]:
                        - generic [ref=e751]: Сжим У 731М (4-10/1,5-10) Sch El (140)
                        - generic [ref=e752]: 130300026_ · покрытие 25,2 дн
                  - cell "критично" [ref=e753]
                  - cell "1 119" [ref=e757]
                  - cell "259" [ref=e758]
                  - cell "0" [ref=e759]
                  - cell "562" [ref=e760]
                  - cell "140" [ref=e761]
                  - cell "1 540" [ref=e762]
                  - cell "610 133 ₸" [ref=e763]
                - row [ref=e764]:
                  - cell [ref=e765]:
                    - button "S397 Роз. RJ45+RJ45 5Е кат 5Е механизм б/рамки \"ATLAS\" белый ATN185 (10) 300200294_ · покрытие 31,3 дн" [ref=e766] [cursor=pointer]:
                      - generic [ref=e770]:
                        - generic [ref=e771]: S397 Роз. RJ45+RJ45 5Е кат 5Е механизм б/рамки "ATLAS" белый ATN185 (10)
                        - generic [ref=e772]: 300200294_ · покрытие 31,3 дн
                  - cell "критично" [ref=e773]
                  - cell "214" [ref=e777]
                  - cell "60" [ref=e778]
                  - cell "0" [ref=e779]
                  - cell "96" [ref=e780]
                  - cell "10" [ref=e781]
                  - cell "250" [ref=e782]
                  - cell "958 850 ₸" [ref=e783]
                - row [ref=e784]:
                  - cell [ref=e785]:
                    - button "S374 Комп. роз. RJ45 5Е механизм б/рамки \"GLOSSA\" белый GSL181K (10) 030200263_ · покрытие 31,5 дн" [ref=e786] [cursor=pointer]:
                      - generic [ref=e790]:
                        - generic [ref=e791]: S374 Комп. роз. RJ45 5Е механизм б/рамки "GLOSSA" белый GSL181K (10)
                        - generic [ref=e792]: 030200263_ · покрытие 31,5 дн
                  - cell "критично" [ref=e793]
                  - cell "5" [ref=e797]
                  - cell "1" [ref=e798]
                  - cell "0" [ref=e799]
                  - cell "5" [ref=e800]
                  - cell "10" [ref=e801]
                  - cell "10" [ref=e802]
                  - cell "себестоимость не задана" [ref=e803]
                - row [ref=e805]:
                  - cell [ref=e806]:
                    - button "K089 Переключ. 2 кл 10А с/у б/рамки \"ATLAS\" КАРБОН ATN1065 (5) 300200519_ · покрытие 33,6 дн" [ref=e807] [cursor=pointer]:
                      - generic [ref=e811]:
                        - generic [ref=e812]: K089 Переключ. 2 кл 10А с/у б/рамки "ATLAS" КАРБОН ATN1065 (5)
                        - generic [ref=e813]: 300200519_ · покрытие 33,6 дн
                  - cell "критично" [ref=e814]
                  - cell "125" [ref=e818]
                  - cell "54" [ref=e819]
                  - cell "0" [ref=e820]
                  - cell "104" [ref=e821]
                  - cell "5" [ref=e822]
                  - cell "180" [ref=e823]
                  - cell "638 766 ₸" [ref=e824]
                - row [ref=e825]:
                  - cell [ref=e826]:
                    - button "S242 2кл.инд о/у 6А IP20 \"Прима\" ВА 56-007-б (130) !!! 030200003_ · покрытие 33,8 дн" [ref=e827] [cursor=pointer]:
                      - generic [ref=e831]:
                        - generic [ref=e832]: S242 2кл.инд о/у 6А IP20 "Прима" ВА 56-007-б (130) !!!
                        - generic [ref=e833]: 030200003_ · покрытие 33,8 дн
                  - cell "критично" [ref=e834]
                  - cell "5" [ref=e838]
                  - cell "4" [ref=e839]
                  - cell "0" [ref=e840]
                  - cell "6" [ref=e841]
                  - cell "1" [ref=e842]
                  - cell "8" [ref=e843]
                  - cell "себестоимость не задана" [ref=e844]
                - row [ref=e846]:
                  - cell [ref=e847]:
                    - button "S231 1кл с/у. 6А IP20 \"Прима\" ВС 16-057-б (96) !!! 030200006_ · покрытие 33,8 дн" [ref=e848] [cursor=pointer]:
                      - generic [ref=e852]:
                        - generic [ref=e853]: S231 1кл с/у. 6А IP20 "Прима" ВС 16-057-б (96) !!!
                        - generic [ref=e854]: 030200006_ · покрытие 33,8 дн
                  - cell "критично" [ref=e855]
                  - cell "3" [ref=e859]
                  - cell "1" [ref=e860]
                  - cell "0" [ref=e861]
                  - cell "9" [ref=e862]
                  - cell "1" [ref=e863]
                  - cell "11" [ref=e864]
                  - cell "себестоимость не задана" [ref=e865]
                - row [ref=e867]:
                  - cell [ref=e868]:
                    - button "S393 Перекрест.переключ. 1 кл 10А с/у б/рамки \"ATLAS\" белый ATN171 (5) 300200291_ · покрытие 34,3 дн" [ref=e869] [cursor=pointer]:
                      - generic [ref=e873]:
                        - generic [ref=e874]: S393 Перекрест.переключ. 1 кл 10А с/у б/рамки "ATLAS" белый ATN171 (5)
                        - generic [ref=e875]: 300200291_ · покрытие 34,3 дн
                  - cell "критично" [ref=e876]
                  - cell "133" [ref=e880]
                  - cell "50" [ref=e881]
                  - cell "0" [ref=e882]
                  - cell "45" [ref=e883]
                  - cell "5" [ref=e884]
                  - cell "130" [ref=e885]
                  - cell "247 302 ₸" [ref=e886]
                - row [ref=e887]:
                  - cell [ref=e888]:
                    - button "K056 Роз. 2-ная с/у 16А с з/к з/ш \"ATLAS\" ГРИФЕЛЬ ATN726 (6) 300200575_ · покрытие 35,7 дн" [ref=e889] [cursor=pointer]:
                      - generic [ref=e893]:
                        - generic [ref=e894]: K056 Роз. 2-ная с/у 16А с з/к з/ш "ATLAS" ГРИФЕЛЬ ATN726 (6)
                        - generic [ref=e895]: 300200575_ · покрытие 35,7 дн
                  - cell "критично" [ref=e896]
                  - cell "102" [ref=e900]
                  - cell "18" [ref=e901]
                  - cell "0" [ref=e902]
                  - cell "24" [ref=e903]
                  - cell "6" [ref=e904]
                  - cell "108" [ref=e905]
                  - cell "231 092 ₸" [ref=e906]
                - row [ref=e907]:
                  - cell [ref=e908]:
                    - button "S4000 Роз. с з/к 16А с/у з/ш с крышкой б/рамки\"ATLAS\" белый ATN146 (15) 300200700_ · покрытие 37,4 дн" [ref=e909] [cursor=pointer]:
                      - generic [ref=e913]:
                        - generic [ref=e914]: S4000 Роз. с з/к 16А с/у з/ш с крышкой б/рамки"ATLAS" белый ATN146 (15)
                        - generic [ref=e915]: 300200700_ · покрытие 37,4 дн
                  - cell "критично" [ref=e916]
                  - cell "130" [ref=e920]
                  - cell "86" [ref=e921]
                  - cell "0" [ref=e922]
                  - cell "109" [ref=e923]
                  - cell "15" [ref=e924]
                  - cell "165" [ref=e925]
                  - cell "169 798 ₸" [ref=e926]
                - row [ref=e927]:
                  - cell [ref=e928]:
                    - button "S362 Выкл 2 кл 10А с/у \"GLOSSA\" белый GSL152 (15) 030200243_ · покрытие 40,3 дн" [ref=e929] [cursor=pointer]:
                      - generic [ref=e933]:
                        - generic [ref=e934]: S362 Выкл 2 кл 10А с/у "GLOSSA" белый GSL152 (15)
                        - generic [ref=e935]: 030200243_ · покрытие 40,3 дн
                  - cell "критично" [ref=e936]
                  - cell "20" [ref=e940]
                  - cell "21" [ref=e941]
                  - cell "0" [ref=e942]
                  - cell "26" [ref=e943]
                  - cell "15" [ref=e944]
                  - cell "30" [ref=e945]
                  - cell "себестоимость не задана" [ref=e946]
            - button "Показать ещё 80 из 254" [ref=e949] [cursor=pointer]
        - paragraph [ref=e950]: Себестоимость есть только у SE («СС реал»); у IEK она не задана, поэтому сумма не считается.
  - button "Open Next.js Dev Tools" [ref=e956] [cursor=pointer]
  - alert [ref=e960]
```

# Test source

```ts
  58  |   await page.keyboard.press('ArrowDown'); await expect(page.getByRole('option').nth(1)).toHaveAttribute('aria-selected', 'true');
  59  |   await shot(page, 'search-results-desktop');
  60  |   await page.keyboard.press('Escape'); await expect(search).toBeFocused(); await expect(page.getByRole('listbox')).toHaveCount(0);
  61  |   await page.keyboard.press('Meta+k'); await search.fill(SKU); await expect(page.getByRole('option')).toHaveCount(1); await page.keyboard.press('Enter');
  62  |   await expect(page).toHaveURL(new RegExp(`/opus_a/skus/${SKU}`)); await ready(page);
  63  |   await page.keyboard.press('Meta+k'); await search.fill('zz-no-such-code'); await expect(page.getByText(/ничего не найдено/)).toBeVisible(); await shot(page, 'search-empty-desktop');
  64  |   await page.route('**/api/skus?**', route => route.fulfill({ status: 503, json: { ok: false, message: 'Недоступно' } }));
  65  |   await search.fill('1302'); await expect(page.getByText('Поиск недоступен.')).toBeVisible(); await shot(page, 'search-unavailable-desktop');
  66  |   await page.unroute('**/api/skus?**'); await page.getByRole('button', { name: 'Повторить', exact: true }).click(); await expect(page.getByRole('option').first()).toBeVisible();
  67  | });
  68  | 
  69  | test('row and tab keys; filter, disclosure and scroll survive SKU return', async ({ page }) => {
  70  |   await page.goto(`${BASE}/opus_a/replenishment?supplier=SE`); await ready(page);
  71  |   const tab = page.getByRole('tab', { name: /^Все / }); await tab.focus(); await page.keyboard.press('ArrowRight');
  72  |   await expect(page.getByRole('tab', { name: /^Критично / })).toBeFocused();
  73  |   const filter = page.getByRole('textbox', { name: 'Фильтр по названию или коду 1С' }); await filter.fill('030200');
  74  |   const rows = page.locator('[data-row-toggle]'); await rows.first().focus(); await page.keyboard.press('j'); await expect(rows.nth(1)).toBeFocused();
  75  |   await page.keyboard.press('k'); await expect(rows.first()).toBeFocused(); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
  76  |   await expect(page.locator('.oa-why')).toBeVisible();
  77  |   await page.getByRole('link', { name: 'Карточка товара', exact: true }).scrollIntoViewIfNeeded();
  78  |   await page.waitForTimeout(80); const scroll = await page.evaluate(() => window.scrollY);
  79  |   await page.getByRole('link', { name: 'Карточка товара', exact: true }).click(); await ready(page);
  80  |   await page.locator('.oa-crumb a').click(); await ready(page);
  81  |   await expect(filter).toHaveValue('030200'); await expect(page.getByRole('tab', { name: /^Критично / })).toHaveAttribute('aria-selected', 'true');
  82  |   await expect(page.locator('.oa-why')).toBeVisible();
  83  |   await expect.poll(() => page.evaluate(() => window.scrollY)).toBeCloseTo(scroll, -1);
  84  |   await rows.nth(1).focus(); await page.keyboard.press('Escape'); await expect(page.locator('.oa-why')).toHaveCount(0);
  85  |   await filter.fill('nothing-found'); await expect(page.getByText('По этому фильтру товаров нет')).toBeVisible(); await shot(page, 'replenishment-filter-empty');
  86  |   await page.getByRole('button', { name: 'Сбросить фильтр' }).click(); await expect(filter).toHaveValue(''); await expect(rows.first()).toBeVisible();
  87  | });
  88  | 
  89  | test('adjust contract: freeze version, 409 blocks resubmit, refresh keeps draft, success', async ({ page, request }) => {
  90  |   const detail = await (await request.get(`${BASE}/api/skus/${SKU}`)).json();
  91  |   const rec = detail.recommendation; let sent: Record<string, unknown> | undefined; let calls = 0;
  92  |   await page.route('**/api/recommendations/*/adjust', async route => {
  93  |     if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204 });
  94  |     sent = route.request().postDataJSON(); calls++;
  95  |     return route.fulfill({ status: calls === 1 ? 409 : 200, json: calls === 1 ? { ok: false, code: 'stale', message: 'stale' } : { ok: true } });
  96  |   });
  97  |   await page.goto(`${BASE}/opus_a/replenishment?supplier=IEK&code=${SKU}`); await ready(page); await openFirstRow(page);
  98  |   await page.getByRole('button', { name: 'Изменить количество', exact: true }).click();
  99  |   const value = page.getByLabel('Количество, шт', { exact: true }); const reason = page.getByLabel('Причина (обязательно)');
  100 |   await expect(value).toBeFocused(); await value.fill('460'); await reason.fill('Клиент подтвердил объём');
  101 |   await page.route(`**/api/skus/${SKU}`, route => route.fulfill({ json: { ...detail, recommendation: { ...rec, version: rec.version + 1 } } }));
  102 |   await page.getByRole('button', { name: 'Сохранить', exact: true }).click(); await expect(page.getByText('Данные обновились', { exact: true })).toBeVisible();
  103 |   expect(sent).toEqual({ qty: 460, reason: 'Клиент подтвердил объём', version: rec.version });
  104 |   await expect(page.getByRole('button', { name: 'Сохранить', exact: true })).toBeDisabled(); await shot(page, 'adjust-stale-contract');
  105 |   await page.getByRole('button', { name: 'Обновить', exact: true }).click(); await expect(value).toHaveValue('460'); await expect(reason).toHaveValue('Клиент подтвердил объём');
  106 |   await expect(page.getByRole('button', { name: 'Сохранить', exact: true })).toBeEnabled(); await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  107 |   await expect(page.getByText('Сохранено: 460 шт')).toBeVisible(); expect(sent?.version).toBe(rec.version + 1); expect(calls).toBe(2); await shot(page, 'adjust-saved-contract');
  108 | });
  109 | 
  110 | for (const viewport of views) {
  111 |   test(`${viewport.name}: proposal 409, no stale repeat, keyboard escape`, async ({ page }) => {
  112 |     await page.setViewportSize(viewport); let version: number | undefined;
  113 |     await page.route('**/api/proposals/*/approve', route => { version = route.request().postDataJSON().proposal_version; return route.fulfill({ status: 409, json: { ok: false, code: 'stale', message: 'stale' } }); });
  114 |     await page.goto(`${BASE}/opus_a/today`); await ready(page);
  115 |     const opener = page.getByRole('button', { name: 'Решить…' }).first(); await opener.focus(); await page.keyboard.press('Enter');
  116 |     const confirm = page.getByRole('button', { name: 'Подготовить заказ' }); await expect(confirm).toBeFocused(); await shot(page, `proposal-confirm-${viewport.name}`);
  117 |     await page.keyboard.press('Enter'); await expect(page.getByText('Данные обновились', { exact: true })).toBeVisible(); await expect(confirm).toBeDisabled(); expect(version).toBeGreaterThan(0);
  118 |     await shot(page, `proposal-stale-${viewport.name}`); if (viewport.name === 'phone') await noOverflow(page);
  119 |     await page.keyboard.press('Escape'); await expect(page.getByRole('button', { name: 'Решить…' }).first()).toBeFocused();
  120 |   });
  121 | }
  122 | 
  123 | test('empty, unavailable, loading, missing SKU and optional EKT states', async ({ page, request }) => {
  124 |   await page.route('**/api/queue', route => route.fulfill({ json: { ok: true, items: [] } }));
  125 |   await page.goto(`${BASE}/opus_a/today`); await ready(page); await expect(page.getByText('Решений нет')).toBeVisible(); await shot(page, 'today-empty');
  126 |   await page.unroute('**/api/queue');
  127 |   for (const [name, api, path] of [['today', '**/api/today', 'today'], ['replenishment', '**/api/recommendations**', 'replenishment'], ['sku', `**/api/skus/${SKU}`, `skus/${SKU}`]]) {
  128 |     await page.route(api, route => route.fulfill({ status: 503, json: { ok: false, message: 'Не удалось получить данные. Повторите попытку.' } }));
  129 |     await page.goto(`${BASE}/opus_a/${path}`); await expect(page.getByText('Данные недоступны').first()).toBeVisible(); await shot(page, `${name}-unavailable`); await page.unroute(api);
  130 |   }
  131 |   await page.route('**/api/recommendations**', async route => { await new Promise(resolve => setTimeout(resolve, 1200)); await route.continue(); });
  132 |   await page.goto(`${BASE}/opus_a/replenishment`); await expect(page.locator('.oa-skel').first()).toBeVisible(); await shot(page, 'replenishment-loading'); await ready(page); await page.unroute('**/api/recommendations**');
  133 |   await page.setViewportSize(views[1]); await page.goto(`${BASE}/opus_a/skus/000000000_`); await expect(page.getByText('Товар не найден')).toBeVisible(); await expect(page.locator('.oa-skel')).toHaveCount(0); await shot(page, 'sku-not-found-phone'); await noOverflow(page);
  134 |   const detail = await (await request.get(`${BASE}/api/skus/${SKU}`)).json();
  135 |   await page.route(`**/api/skus/${SKU}`, route => route.fulfill({ json: { ...detail, ekt: { price: '123.45', currency: 'KZT', stock_total: 400, as_of: '2026-09-22T10:00:00Z', source: 'ekt_api_snapshot' } } }));
  136 |   await page.goto(`${BASE}/opus_a/skus/${SKU}`); await ready(page); await page.getByRole('heading', { name: 'Каталог ЭКТ' }).scrollIntoViewIfNeeded(); await expect(page.locator('.oa-ekt')).toContainText('123,45'); await shot(page, 'sku-ekt-contract-phone'); await noOverflow(page);
  137 | });
  138 | 
  139 | test('320px, touch targets, visible focus and reduced motion', async ({ page }) => {
  140 |   await page.setViewportSize({ width: 320, height: 844 }); await page.emulateMedia({ reducedMotion: 'reduce' });
  141 |   for (const path of ['today', 'replenishment?supplier=SE', `skus/${SKU}`]) {
  142 |     await page.goto(`${BASE}/opus_a/${path}`); await ready(page); await noOverflow(page);
  143 |     const small = await page.locator('.oa-btn,.oa-nav a,.oa-tabs button,.oa-seg a,.oa-search label').evaluateAll(nodes => nodes.filter(node => node.getBoundingClientRect().height < 44 && node.getBoundingClientRect().width > 0).map(node => ({ text: node.textContent, height: node.getBoundingClientRect().height })));
  144 |     expect(small).toEqual([]);
  145 |   }
  146 |   await page.getByRole('combobox').focus(); expect(await page.getByRole('combobox').evaluate(node => getComputedStyle(node.closest('label')!).boxShadow)).not.toBe('none');
  147 |   await page.goto(`${BASE}/opus_a/replenishment?supplier=SE`); await ready(page); await page.locator('[data-row-toggle]').first().focus();
  148 |   expect(await page.locator('[data-row-toggle]').first().evaluate(node => getComputedStyle(node).outlineStyle)).toBe('solid'); await shot(page, 'focus-phone-320');
  149 | });
  150 | 
  151 | test('real recalculation: complete run, busy state and history', async ({ page, request }) => {
  152 |   await page.goto(`${BASE}/opus_a/replenishment?supplier=SE`); await ready(page);
  153 |   const previous = await (await request.get(`${BASE}/api/calc/runs`)).json();
  154 |   const response = page.waitForResponse(response => response.url().endsWith('/api/calc/run') && response.request().method() === 'POST');
  155 |   await page.getByRole('button', { name: 'Пересчитать всё' }).click();
  156 |   await expect(page.getByRole('button', { name: 'Считаю…' })).toBeDisabled();
  157 |   expect((await response).ok()).toBe(true); await expect(page.getByText(/Расчёт готов:/)).toBeVisible();
> 158 |   const current = await (await request.get(`${BASE}/api/calc/runs`)).json(); expect(current.runs[0].id).not.toBe(previous.runs[0].id); expect(current.runs[0].scope.supplier).toBeUndefined(); expect(current.runs[0].scope.codes.length).toBeGreaterThan(1000);
      |                                        ^ Error: apiRequestContext.get: read ECONNRESET
  159 |   const recommendations = await (await request.get(`${BASE}/api/recommendations`)).json(); expect(recommendations.groups.map((group: { supplier_id: string }) => group.supplier_id).sort()).toEqual(['IEK', 'SE']);
  160 |   await page.locator('.oa-run-history summary').click(); await expect(page.locator('.oa-run-history li').first()).toContainText('Все поставщики'); await shot(page, 'run-history-desktop');
  161 | });
  162 | 
  163 | test('real local order: prepare, approve exact version, download CSV/XLSX with Код 1с', async ({ page }) => {
  164 |   await page.goto(`${BASE}/opus_a/today`); await ready(page);
  165 |   await page.getByRole('button', { name: 'Решить…' }).first().click();
  166 |   const prepared = page.waitForResponse(response => /\/api\/proposals\/[^/]+\/approve$/.test(response.url()) && response.request().method() === 'POST');
  167 |   await page.getByRole('button', { name: 'Подготовить заказ' }).click();
  168 |   const result = await (await prepared).json();
  169 |   const order = page.locator(`[id="order-${result.po_id}"]`); await expect(order).toBeVisible();
  170 |   await order.getByRole('button', { name: 'Проверить и утвердить' }).click();
  171 |   const approved = page.waitForResponse(response => response.url().endsWith(`/api/orders/${result.po_id}/approve`));
  172 |   await order.getByRole('button', { name: 'Утвердить заказ', exact: true }).click(); expect((await approved).ok()).toBe(true); await expect(order.getByText('Утверждён', { exact: true })).toBeVisible();
  173 |   await order.scrollIntoViewIfNeeded(); await shot(page, 'approved-order-desktop');
  174 |   for (const format of ['CSV', 'XLSX']) {
  175 |     const downloaded = page.waitForEvent('download'); await order.getByRole('link', { name: format, exact: true }).click(); const download = await downloaded;
  176 |     const file = await download.path(); expect(file).not.toBeNull(); const buffer = await readFile(file!);
  177 |     if (format === 'CSV') { expect(buffer.toString('utf8')).toContain('Код 1с'); expect(buffer.toString('utf8')).toMatch(/\d{9}_/); }
  178 |     else { const workbook = XLSX.read(buffer); const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 }); expect(JSON.stringify(rows)).toContain('Код 1с'); expect(JSON.stringify(rows)).toMatch(/\d{9}_/); }
  179 |   }
  180 |   await page.setViewportSize(views[1]); await order.scrollIntoViewIfNeeded(); await shot(page, 'approved-order-phone'); await noOverflow(page);
  181 | });
  182 | 
  183 | for (const viewport of views) {
  184 |   test(`${viewport.name}: loading, empty and unavailable state matrix`, async ({ page, request }) => {
  185 |     test.setTimeout(90_000); await page.setViewportSize(viewport);
  186 |     for (const [name, api, path] of [['today', '**/api/today', 'today'], ['replenishment', '**/api/recommendations**', 'replenishment'], ['sku', `**/api/skus/${SKU}`, `skus/${SKU}`]]) {
  187 |       let release!: () => void; const blocked = new Promise<void>(resolve => { release = resolve; });
  188 |       await page.route(api, async route => { await blocked; await route.continue(); });
  189 |       await page.goto(`${BASE}/opus_a/${path}`); await expect(page.locator('.oa-skel').first()).toBeVisible();
  190 |       await page.screenshot({ path: `${OUT}/${name}-loading-${viewport.name}.png` }); release(); await ready(page); await page.unroute(api);
  191 |       await page.route(api, route => route.fulfill({ status: 503, json: { ok: false, message: 'Не удалось получить данные. Повторите попытку.' } }));
  192 |       await page.reload(); await expect(page.getByText('Данные недоступны').first()).toBeVisible(); await shot(page, `${name}-unavailable-${viewport.name}`); await noOverflow(page); await page.unroute(api);
  193 |     }
  194 |     await page.route('**/api/recommendations**', route => route.fulfill({ json: { ok: true, groups: [], state_version: 1 } }));
  195 |     await page.goto(`${BASE}/opus_a/replenishment`); await ready(page); await expect(page.getByText('Рекомендаций нет')).toBeVisible(); await shot(page, `replenishment-empty-${viewport.name}`); await page.unroute('**/api/recommendations**');
  196 |     const detail = await (await request.get(`${BASE}/api/skus/${SKU}`)).json();
  197 |     await page.route(`**/api/skus/${SKU}`, route => route.fulfill({ json: { ...detail, recommendation: null, sku: { ...detail.sku, image_url: null } } }));
  198 |     await page.goto(`${BASE}/opus_a/skus/${SKU}`); await ready(page); await expect(page.locator('.oa-sku-title img')).toHaveCount(0); await page.locator('#oa-rec').scrollIntoViewIfNeeded(); await shot(page, `sku-no-recommendation-${viewport.name}`); await noOverflow(page);
  199 |   });
  200 | }
  201 | 
  202 | test('order conflict binds reviewed version and cannot silently repeat approval', async ({ page, request }) => {
  203 |   const data = await (await request.get(`${BASE}/api/orders`)).json();
  204 |   const draft = { ...data.orders[0], state: 'draft', version: 7 }; let calls = 0;
  205 |   await page.route('**/api/orders', route => route.fulfill({ json: { ok: true, orders: [draft] } }));
  206 |   await page.route(`**/api/orders/${draft.id}/approve`, route => { calls++; expect(route.request().postDataJSON()).toEqual({ version: 7 }); return route.fulfill({ status: 409, json: { ok: false, code: 'stale_order_version', message: 'stale' } }); });
  207 |   await page.goto(`${BASE}/opus_a/today`); await ready(page); const order = page.locator('.oa-order');
  208 |   const opener = order.getByRole('button', { name: 'Проверить и утвердить' }); await opener.click(); await page.keyboard.press('Escape'); await expect(opener).toBeFocused(); await opener.click();
  209 |   const confirm = order.getByRole('button', { name: 'Утвердить заказ', exact: true }); await confirm.click(); await expect(order.getByText('Данные обновились')).toBeVisible(); await expect(confirm).toBeDisabled(); expect(calls).toBe(1); await shot(page, 'order-stale-desktop');
  210 | });
  211 | 
```