# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: opus_a.spec.ts >> real local order: prepare, approve exact version, download CSV/XLSX with Код 1с
- Location: tests/e2e/opus_a.spec.ts:162:5

# Error details

```
Test timeout of 45000ms exceeded.
```

```
Error: page.waitForEvent: Test timeout of 45000ms exceeded.
=========================== logs ===========================
waiting for event "download"
============================================================
```

# Page snapshot

```yaml
- generic [ref=e1]:
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
            - generic [ref=e52]: Закупки · Электрокомплект
            - heading "Сегодня" [level=1] [ref=e53]
          - link "Проверить рекомендации" [ref=e55] [cursor=pointer]:
            - /url: /opus_a/replenishment
        - generic [ref=e58]:
          - paragraph [ref=e59]: "Нужно решение: Проверить отсутствующие источники IEK: 500 SKU."
          - generic "Источник, AI, внешнее действие" [ref=e61]:
            - generic "provenance=partner_anonymised" [ref=e62]: Данные партнёра · обезличены
            - generic "ai=replay" [ref=e63]: Воспроизведение · записанное решение
            - generic "external=export_only" [ref=e64]: Экспорт для 1С (файл)
          - generic [ref=e66]:
            - generic [ref=e67]:
              - text: "Последний расчёт:"
              - time [ref=e68]: 23 сент., 03:59
            - button "Пересчитать всё" [ref=e69] [cursor=pointer]
            - group [ref=e75]:
              - generic "История расчётов" [ref=e76] [cursor=pointer]
        - region "Главные цифры" [ref=e77]:
          - generic [ref=e78]:
            - generic [ref=e79]: Под риском дефицита
            - generic [ref=e82]:
              - text: "636"
              - generic [ref=e83]: SKU
            - generic [ref=e84]: запаса меньше, чем на срок поставки
            - 'link "Под риском дефицита: открыть" [ref=e85] [cursor=pointer]':
              - /url: /opus_a/replenishment
          - generic [ref=e86]:
            - generic [ref=e87]: Ждут вашего решения
            - generic [ref=e88]:
              - text: "11"
              - generic [ref=e89]: решений
            - generic [ref=e90]: 1 заказ поставщикам · 10 задач
          - generic [ref=e91]:
            - generic [ref=e92]: Стоимость рекомендаций
            - generic [ref=e93]: —
            - generic [ref=e94]: "IEK: себестоимость не задана"
          - generic [ref=e95]:
            - generic [ref=e96]: Агенты сделали сами
            - generic [ref=e97]:
              - text: 13 221
              - generic [ref=e98]: действие
            - generic [ref=e99]: 99,8 % без вас · 24 ждут вас
        - generic [ref=e103]:
          - generic [ref=e104]:
            - region [ref=e105]:
              - generic [ref=e106]:
                - heading "Ждут вашего решения 11" [level=2] [ref=e107]:
                  - text: Ждут вашего решения
                  - generic [ref=e108]: "11"
                - generic [ref=e109]: Агенты ничего не отправляют без вашего решения
              - status [ref=e110]:
                - generic [ref=e114]:
                  - strong [ref=e115]: "Заказ поставщику SE: 294 позиций. Черновик готов к утверждению."
                  - link "Проверить и утвердить заказ" [ref=e117] [cursor=pointer]:
                    - /url: "#order-PO-ac130249-5f36-4319-b6c4-85d9ab6e448f"
              - list [ref=e118]:
                - listitem [ref=e119]:
                  - generic [ref=e125]:
                    - 'heading "Проверить отсутствующие источники IEK: 500 SKU" [level=3] [ref=e126]'
                    - paragraph [ref=e127]: "Нет свежего остатка по 500 SKU — проверьте склад перед заказом. Например: 010300125_ — остаток на фев 2025; 010300127_ — остаток на янв 2026; 010300130_ — остаток на май 2026."
                    - generic [ref=e128]:
                      - generic [ref=e129]: Нужна ваша проверка
                      - generic [ref=e130]: 500 источников · с 23 сент., 02:54
                  - link "Открыть проверку" [ref=e132] [cursor=pointer]:
                    - /url: /review/TK-51d16491-f6aa-409a-b40f-3b506c5cb0e3
                - listitem [ref=e133]:
                  - generic [ref=e139]:
                    - 'heading "Проверить отсутствующие источники SE: 38 SKU" [level=3] [ref=e140]'
                    - paragraph [ref=e141]: "Нет свежего остатка по 38 SKU — проверьте склад перед заказом. Например: 030200008_ — остаток на янв 2026; 030200029_ — остаток на май 2026; 030200030_ — остаток на июл 2026."
                    - generic [ref=e142]:
                      - generic [ref=e143]: Нужна ваша проверка
                      - generic [ref=e144]: 38 источников · с 23 сент., 02:54
                  - link "Открыть проверку" [ref=e146] [cursor=pointer]:
                    - /url: /review/TK-006a8034-e330-41dc-b77a-f1a2a72ac8a5
                - listitem [ref=e147]:
                  - generic [ref=e153]:
                    - 'heading "Проверить отсутствующие источники IEK: 500 SKU" [level=3] [ref=e154]'
                    - paragraph [ref=e155]: "Нет свежего остатка по 500 SKU — проверьте склад перед заказом. Например: 010300125_ — остаток на фев 2025; 010300127_ — остаток на янв 2026; 010300130_ — остаток на май 2026."
                    - generic [ref=e156]:
                      - generic [ref=e157]: Нужна ваша проверка
                      - generic [ref=e158]: 500 источников · с 23 сент., 03:24
                  - link "Открыть проверку" [ref=e160] [cursor=pointer]:
                    - /url: /review/TK-3b20570b-928a-4411-ad89-ddf57b48fbb2
                - listitem [ref=e161]:
                  - generic [ref=e167]:
                    - 'heading "Проверить отсутствующие источники SE: 38 SKU" [level=3] [ref=e168]'
                    - paragraph [ref=e169]: "Нет свежего остатка по 38 SKU — проверьте склад перед заказом. Например: 030200008_ — остаток на янв 2026; 030200029_ — остаток на май 2026; 030200030_ — остаток на июл 2026."
                    - generic [ref=e170]:
                      - generic [ref=e171]: Нужна ваша проверка
                      - generic [ref=e172]: 38 источников · с 23 сент., 03:24
                  - link "Открыть проверку" [ref=e174] [cursor=pointer]:
                    - /url: /review/TK-4f9f2fae-b99d-4e70-9911-c8a9665114d1
                - listitem [ref=e175]:
                  - generic [ref=e181]:
                    - 'heading "Проверить отсутствующие источники SE: 38 SKU" [level=3] [ref=e182]'
                    - paragraph [ref=e183]: "Нет свежего остатка по 38 SKU — проверьте склад перед заказом. Например: 030200008_ — остаток на янв 2026; 030200029_ — остаток на май 2026; 030200030_ — остаток на июл 2026."
                    - generic [ref=e184]:
                      - generic [ref=e185]: Нужна ваша проверка
                      - generic [ref=e186]: 38 источников · с 23 сент., 03:47
                  - link "Открыть проверку" [ref=e188] [cursor=pointer]:
                    - /url: /review/TK-9132e177-ae1f-4232-9162-cc4784358e05
                - listitem [ref=e189]:
                  - generic [ref=e195]:
                    - 'heading "Проверить отсутствующие источники SE: 38 SKU" [level=3] [ref=e196]'
                    - paragraph [ref=e197]: "Нет свежего остатка по 38 SKU — проверьте склад перед заказом. Например: 030200008_ — остаток на янв 2026; 030200029_ — остаток на май 2026; 030200030_ — остаток на июл 2026."
                    - generic [ref=e198]:
                      - generic [ref=e199]: Нужна ваша проверка
                      - generic [ref=e200]: 38 источников · с 23 сент., 03:53
                  - link "Открыть проверку" [ref=e202] [cursor=pointer]:
                    - /url: /review/TK-0307ef25-a556-41d4-b9b2-76744d65b9c0
                - listitem [ref=e203]:
                  - generic [ref=e209]:
                    - 'heading "Проверить отсутствующие источники SE: 38 SKU" [level=3] [ref=e210]'
                    - paragraph [ref=e211]: "Нет свежего остатка по 38 SKU — проверьте склад перед заказом. Например: 030200008_ — остаток на янв 2026; 030200029_ — остаток на май 2026; 030200030_ — остаток на июл 2026."
                    - generic [ref=e212]:
                      - generic [ref=e213]: Нужна ваша проверка
                      - generic [ref=e214]: 38 источников · с 23 сент., 03:54
                  - link "Открыть проверку" [ref=e216] [cursor=pointer]:
                    - /url: /review/TK-a0cc62b6-2bda-4dd6-b1e6-cfffc6bc600d
                - listitem [ref=e217]:
                  - generic [ref=e223]:
                    - 'heading "Проверить отсутствующие источники IEK: 500 SKU" [level=3] [ref=e224]'
                    - paragraph [ref=e225]: "Нет свежего остатка по 500 SKU — проверьте склад перед заказом. Например: 010300125_ — остаток на фев 2025; 010300127_ — остаток на янв 2026; 010300130_ — остаток на май 2026."
                    - generic [ref=e226]:
                      - generic [ref=e227]: Нужна ваша проверка
                      - generic [ref=e228]: 500 источников · с 23 сент., 03:54
                  - link "Открыть проверку" [ref=e230] [cursor=pointer]:
                    - /url: /review/TK-ddb4eae5-cf5b-4611-b099-2d0f7e6b4ad8
                - listitem [ref=e231]:
                  - generic [ref=e238]:
                    - 'heading "Заказ поставщику IEK: 965 позиций" [level=3] [ref=e239]'
                    - paragraph [ref=e240]: "Заказ IEK: 965 позиций, 288172 шт. Стоимость известна для 0 из 965 позиций; неизвестные цены требуют проверки. Подтвердите точный состав и количество перед передачей."
                    - generic [ref=e241]:
                      - generic [ref=e242]: ждёт вас
                      - generic [ref=e243]: 965 источников · с 23 сент., 03:59
                  - generic [ref=e244]:
                    - generic [ref=e245]: себестоимость не задана
                    - generic [ref=e246]: известная стоимость
                  - generic [ref=e247]:
                    - button "Решить…" [ref=e248] [cursor=pointer]
                    - link "Проверить количества" [ref=e249] [cursor=pointer]:
                      - /url: /opus_a/replenishment?supplier=IEK
                - listitem [ref=e250]:
                  - generic [ref=e256]:
                    - 'heading "Проверить отсутствующие источники IEK: 500 SKU" [level=3] [ref=e257]'
                    - paragraph [ref=e258]: "Нет свежего остатка по 500 SKU — проверьте склад перед заказом. Например: 010300125_ — остаток на фев 2025; 010300127_ — остаток на янв 2026; 010300130_ — остаток на май 2026."
                    - generic [ref=e259]:
                      - generic [ref=e260]: Нужна ваша проверка
                      - generic [ref=e261]: 500 источников · с 23 сент., 03:59
                  - link "Открыть проверку" [ref=e263] [cursor=pointer]:
                    - /url: /review/TK-ce812a4f-1fe6-4af6-abcf-6da14b3bc699
                - listitem [ref=e264]:
                  - generic [ref=e270]:
                    - 'heading "Проверить отсутствующие источники SE: 38 SKU" [level=3] [ref=e271]'
                    - paragraph [ref=e272]: "Нет свежего остатка по 38 SKU — проверьте склад перед заказом. Например: 030200008_ — остаток на янв 2026; 030200029_ — остаток на май 2026; 030200030_ — остаток на июл 2026."
                    - generic [ref=e273]:
                      - generic [ref=e274]: Нужна ваша проверка
                      - generic [ref=e275]: 38 источников · с 23 сент., 03:59
                  - link "Открыть проверку" [ref=e277] [cursor=pointer]:
                    - /url: /review/TK-560f3e3f-f038-4423-b33a-d9a42a3e5185
            - region [ref=e278]:
              - heading "Подготовленные заказы" [level=2] [ref=e279]
              - article [ref=e280]:
                - generic [ref=e281]:
                  - heading "Заказ · SE" [level=3] [ref=e282]
                  - generic [ref=e283]: Утверждён
                - generic [ref=e284]:
                  - strong [ref=e285]: 67 763 248 ₸
                  - generic [ref=e286]: 294 позиций · 67 753 шт · ожидается 12 нояб. 2026
                - paragraph [ref=e287]: Цена известна для 262 из 294 позиций. Сумма неполная. Поставщику не отправлен.
                - group [ref=e288]:
                  - generic "Состав заказа" [ref=e289] [cursor=pointer]
                - generic [ref=e290]:
                  - generic [ref=e291]: Экспорт для 1С · поле «Код 1с»
                  - link "CSV" [ref=e292] [cursor=pointer]:
                    - /url: /api/orders/PO-6c74b444-aef0-429a-8c44-403f90d388b9/export.csv
                  - link "XLSX" [ref=e296] [cursor=pointer]:
                    - /url: /api/orders/PO-6c74b444-aef0-429a-8c44-403f90d388b9/export.xlsx
              - article [ref=e300]:
                - generic [ref=e301]:
                  - heading "Заказ · SE" [level=3] [ref=e302]
                  - generic [ref=e303]: Утверждён
                - generic [ref=e304]:
                  - strong [ref=e305]: 67 763 248 ₸
                  - generic [ref=e306]: 294 позиций · 67 753 шт · ожидается 12 нояб. 2026
                - paragraph [ref=e307]: Цена известна для 262 из 294 позиций. Сумма неполная. Поставщику не отправлен.
                - group [ref=e308]:
                  - generic "Состав заказа" [ref=e309] [cursor=pointer]
                - generic [ref=e310]:
                  - generic [ref=e311]: Экспорт для 1С · поле «Код 1с»
                  - link "CSV" [disabled] [active] [ref=e312]:
                    - /url: /api/orders/PO-ac130249-5f36-4319-b6c4-85d9ab6e448f/export.csv
                  - link "XLSX" [disabled] [ref=e316]:
                    - /url: /api/orders/PO-ac130249-5f36-4319-b6c4-85d9ab6e448f/export.xlsx
              - article [ref=e320]:
                - generic [ref=e321]:
                  - heading "Заказ · SE" [level=3] [ref=e322]
                  - generic [ref=e323]: Утверждён
                - generic [ref=e324]:
                  - strong [ref=e325]: 67 763 248 ₸
                  - generic [ref=e326]: 294 позиций · 67 753 шт · ожидается 12 нояб. 2026
                - paragraph [ref=e327]: Цена известна для 262 из 294 позиций. Сумма неполная. Поставщику не отправлен.
                - group [ref=e328]:
                  - generic "Состав заказа" [ref=e329] [cursor=pointer]
                - generic [ref=e330]:
                  - generic [ref=e331]: Экспорт для 1С · поле «Код 1с»
                  - link "CSV" [ref=e332] [cursor=pointer]:
                    - /url: /api/orders/PO-c4afa1fc-445b-4f5d-a2e7-cfcceeffe256/export.csv
                  - link "XLSX" [ref=e336] [cursor=pointer]:
                    - /url: /api/orders/PO-c4afa1fc-445b-4f5d-a2e7-cfcceeffe256/export.xlsx
              - article [ref=e340]:
                - generic [ref=e341]:
                  - heading "Заказ · SE" [level=3] [ref=e342]
                  - generic [ref=e343]: Утверждён
                - generic [ref=e344]:
                  - strong [ref=e345]: 67 763 248 ₸
                  - generic [ref=e346]: 294 позиций · 67 753 шт · ожидается 12 нояб. 2026
                - paragraph [ref=e347]: Цена известна для 262 из 294 позиций. Сумма неполная. Поставщику не отправлен.
                - group [ref=e348]:
                  - generic "Состав заказа" [ref=e349] [cursor=pointer]
                - generic [ref=e350]:
                  - generic [ref=e351]: Экспорт для 1С · поле «Код 1с»
                  - link "CSV" [ref=e352] [cursor=pointer]:
                    - /url: /api/orders/PO-cd0e8547-5f96-46b3-a752-44cff976190a/export.csv
                  - link "XLSX" [ref=e356] [cursor=pointer]:
                    - /url: /api/orders/PO-cd0e8547-5f96-46b3-a752-44cff976190a/export.xlsx
            - region [ref=e360]:
              - generic [ref=e361]:
                - heading "Риск дефицита 636 SKU, самые срочные" [level=2] [ref=e362]:
                  - text: Риск дефицита
                  - generic [ref=e363]: 636 SKU, самые срочные
                - link "Все рекомендации" [ref=e364] [cursor=pointer]:
                  - /url: /opus_a/replenishment
              - list [ref=e365]:
                - listitem [ref=e366]:
                  - link "УЗО АД 14 (4ф) 16А IEK (3/24) 010300008_ 36,6 дн покрытия · срок 40 дн критично" [ref=e367] [cursor=pointer]:
                    - /url: /opus_a/skus/010300008_?from=%2Fopus_a%2Ftoday
                    - generic [ref=e369]:
                      - generic [ref=e370]: УЗО АД 14 (4ф) 16А IEK (3/24)
                      - generic [ref=e371]: 010300008_
                    - generic [ref=e372]: 36,6 дн покрытия · срок 40 дн
                    - generic [ref=e377]: критично
                - listitem [ref=e381]:
                  - link "УЗО ВД1 63 (2ф) 32А 30мА IEK (1/48) 010300016_ нет запаса · −7,5 дн · срок 40 дн критично" [ref=e382] [cursor=pointer]:
                    - /url: /opus_a/skus/010300016_?from=%2Fopus_a%2Ftoday
                    - generic [ref=e384]:
                      - generic [ref=e385]: УЗО ВД1 63 (2ф) 32А 30мА IEK (1/48)
                      - generic [ref=e386]: 010300016_
                    - generic [ref=e387]: нет запаса · −7,5 дн · срок 40 дн
                    - generic [ref=e391]: критично
                - listitem [ref=e395]:
                  - link "УЗО ВД1 63 (2ф) 40А 30мА IEK (1/48) 010300017_ нет запаса · −96,6 дн · срок 40 дн критично" [ref=e396] [cursor=pointer]:
                    - /url: /opus_a/skus/010300017_?from=%2Fopus_a%2Ftoday
                    - generic [ref=e398]:
                      - generic [ref=e399]: УЗО ВД1 63 (2ф) 40А 30мА IEK (1/48)
                      - generic [ref=e400]: 010300017_
                    - generic [ref=e401]: нет запаса · −96,6 дн · срок 40 дн
                    - generic [ref=e405]: критично
                - listitem [ref=e409]:
                  - link "УЗО ВД1 63 (2ф) 50А 30мА IEK (1/48) 010300018_ 32,8 дн покрытия · срок 40 дн критично" [ref=e410] [cursor=pointer]:
                    - /url: /opus_a/skus/010300018_?from=%2Fopus_a%2Ftoday
                    - generic [ref=e412]:
                      - generic [ref=e413]: УЗО ВД1 63 (2ф) 50А 30мА IEK (1/48)
                      - generic [ref=e414]: 010300018_
                    - generic [ref=e415]: 32,8 дн покрытия · срок 40 дн
                    - generic [ref=e420]: критично
                - listitem [ref=e424]:
                  - link "УЗО АВДТ 32 25А IEK (6/60) 010300053_ 24,2 дн покрытия · срок 40 дн критично" [ref=e425] [cursor=pointer]:
                    - /url: /opus_a/skus/010300053_?from=%2Fopus_a%2Ftoday
                    - generic [ref=e427]:
                      - generic [ref=e428]: УЗО АВДТ 32 25А IEK (6/60)
                      - generic [ref=e429]: 010300053_
                    - generic [ref=e430]: 24,2 дн покрытия · срок 40 дн
                    - generic [ref=e435]: критично
          - complementary "Деньги и агенты" [ref=e439]:
            - region [ref=e440]:
              - heading "Деньги" [level=2] [ref=e441]
              - generic [ref=e442]:
                - generic [ref=e443]:
                  - generic [ref=e444]: Обязательства · SE
                  - generic [ref=e445]: 271 052 993 ₸
                  - generic [ref=e446]: 1 176 строк · цена известна для 1 048
                - generic [ref=e447]:
                  - generic [ref=e448]: Выплата
                  - generic [ref=e449]: −20 328 975 ₸
                  - generic [ref=e450]: 23 сент. 2026
                - generic [ref=e451]:
                  - generic [ref=e452]: Выплата
                  - generic [ref=e453]: −20 328 975 ₸
                  - generic [ref=e454]: 23 сент. 2026
                - generic [ref=e455]:
                  - generic [ref=e456]: Выплата
                  - generic [ref=e457]: −20 328 975 ₸
                  - generic [ref=e458]: 23 сент. 2026
                - generic [ref=e459]:
                  - generic [ref=e460]: Выплата
                  - generic [ref=e461]: −20 328 975 ₸
                  - generic [ref=e462]: 23 сент. 2026
                - generic [ref=e463]:
                  - generic [ref=e464]: Стоимость запаса
                  - generic [ref=e465]: 144 117 721 ₸
                  - generic [ref=e466]: себестоимость известна для 13 % позиций
                - generic [ref=e469]:
                  - generic [ref=e470]: Себестоимость не задана
                  - generic [ref=e471]: 3 417
                - generic [ref=e472]:
                  - generic [ref=e473]: Начальный остаток денег не задан
                  - generic [ref=e474]: "1"
            - region [ref=e475]:
              - generic [ref=e476]:
                - heading "Что сделали агенты" [level=2] [ref=e477]
                - generic "Agents · partner data" [ref=e478]: Агенты · данные партнёра
              - list "Журнал агентов" [ref=e479]:
                - listitem [ref=e480]:
                  - generic [ref=e482]:
                    - generic [ref=e483]: Подготовлен черновик заказа PO-ac130249-5f36-4319-b6c4-85d9ab6e448f
                    - generic [ref=e484]: сам
                  - time [ref=e485]: 04:00
                - listitem [ref=e486]:
                  - generic [ref=e488]:
                    - generic [ref=e489]: Одобрено предложение PR-ca430146-de23-4ffc-a7e2-3534f0bc5e24
                    - generic [ref=e490]: ждёт вас
                  - time [ref=e491]: 04:00
                - listitem [ref=e492]:
                  - generic [ref=e494]:
                    - generic [ref=e495]: Требуются данные для 38 SKU SE
                    - generic [ref=e496]: ждёт вас
                  - time [ref=e497]: 03:59
                - listitem [ref=e498]:
                  - generic [ref=e500]:
                    - generic [ref=e501]: "Создана задача: Проверить отсутствующие источники SE: 38 SKU"
                    - generic [ref=e502]: сам
                  - time [ref=e503]: 03:59
                - listitem [ref=e504]:
                  - generic [ref=e506]:
                    - generic [ref=e507]: Требуются данные для 500 SKU IEK
                    - generic [ref=e508]: ждёт вас
                  - time [ref=e509]: 03:59
                - listitem [ref=e510]:
                  - generic [ref=e512]:
                    - generic [ref=e513]: "Создана задача: Проверить отсутствующие источники IEK: 500 SKU"
                    - generic [ref=e514]: сам
                  - time [ref=e515]: 03:59
                - listitem [ref=e516]:
                  - generic [ref=e518]:
                    - generic [ref=e519]: Нужно решение по заказу SE
                    - generic [ref=e520]: ждёт вас
                  - time [ref=e521]: 03:59
                - listitem [ref=e522]:
                  - generic [ref=e524]:
                    - generic [ref=e525]: Создана задача проверить заказ SE
                    - generic [ref=e526]: сам
                  - time [ref=e527]: 03:59
                - listitem [ref=e528]:
                  - generic [ref=e530]:
                    - generic [ref=e531]: "Подготовлены рекомендации SE: 294 позиций"
                    - generic [ref=e532]: сам
                  - time [ref=e533]: 03:59
                - listitem [ref=e534]:
                  - generic [ref=e536]:
                    - generic [ref=e537]: Предложение PR-93752418-f9ee-435d-8e3e-1e9f76e91b60 заменено новой версией PR-ca430146-de23-4ffc-a7e2-3534f0bc5e24
                    - generic [ref=e538]: сам
                  - time [ref=e539]: 03:59
                - listitem [ref=e540]:
                  - generic [ref=e542]:
                    - generic [ref=e543]: Нужно решение по заказу IEK
                    - generic [ref=e544]: ждёт вас
                  - time [ref=e545]: 03:59
                - listitem [ref=e546]:
                  - generic [ref=e548]:
                    - generic [ref=e549]: Создана задача проверить заказ IEK
                    - generic [ref=e550]: сам
                  - time [ref=e551]: 03:59
              - generic [ref=e552]: 13 221 сами · 24 ждут вас
            - generic [ref=e556]: Экспорт для 1С (файл) — после утверждения заказа.
  - button "Open Next.js Dev Tools" [ref=e565] [cursor=pointer]
  - alert [ref=e569]
```

# Test source

```ts
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
  158 |   const current = await (await request.get(`${BASE}/api/calc/runs`)).json(); expect(current.runs[0].id).not.toBe(previous.runs[0].id); expect(current.runs[0].scope.supplier).toBeUndefined(); expect(current.runs[0].scope.codes.length).toBeGreaterThan(1000);
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
> 174 |   for (const format of ['CSV', 'XLSX']) {
      |                             ^ Error: page.waitForEvent: Test timeout of 45000ms exceeded.
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