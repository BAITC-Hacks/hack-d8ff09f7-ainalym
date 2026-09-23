# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: opus_a.spec.ts >> real local order: prepare, approve exact version, download CSV/XLSX with Код 1с
- Location: tests/e2e/opus_a.spec.ts:163:5

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  locator('.oa-skel')
Expected: 0
Received: 11
Timeout:  20000ms

Call log:
  - Expect "toHaveCount" locator('.oa-skel') with timeout 20000ms
  - waiting for locator('.oa-skel')
    32 × locator resolved to 31 elements
       - unexpected value "31"
    12 × locator resolved to 11 elements
       - unexpected value "11"

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
        - link "Сегодня" [ref=e7] [cursor=pointer]:
          - /url: /opus_a/today
        - link "Пополнение" [ref=e12] [cursor=pointer]:
          - /url: /opus_a/replenishment
        - link "Товар" [ref=e18] [cursor=pointer]:
          - /url: /opus_a/skus/130200122_
        - link "Основной интерфейс" [ref=e27] [cursor=pointer]:
          - /url: /today
      - generic [ref=e33]:
        - status [ref=e34]: Синхронизация включена
        - generic [ref=e36]: Данные партнёра · обезличены
    - generic [ref=e37]:
      - banner [ref=e38]:
        - generic [ref=e40]:
          - generic [aria-hidden] [ref=e44]: ⌘
          - generic [aria-hidden] [ref=e45]: K
          - combobox "Поиск товара" [ref=e46]
      - main [ref=e47]:
        - generic [ref=e48]:
          - generic [ref=e49]:
            - generic [ref=e50]: Закупки · Электрокомплект
            - heading "Сегодня" [level=1] [ref=e51]
          - link "Проверить рекомендации" [ref=e53] [cursor=pointer]:
            - /url: /opus_a/replenishment
        - generic [ref=e56]:
          - generic "Источник, AI, внешнее действие" [ref=e59]:
            - generic "provenance=partner_anonymised" [ref=e60]: Данные партнёра · обезличены
            - generic "ai=replay" [ref=e61]: Воспроизведение · записанное решение
            - generic "external=export_only" [ref=e62]: Экспорт для 1С (файл)
          - generic [ref=e64]:
            - generic [ref=e65]:
              - text: "Последний расчёт:"
              - time [ref=e66]: 23 сент., 04:02
            - button "Пересчитать всё" [ref=e67] [cursor=pointer]
            - group [ref=e73]:
              - generic "История расчётов" [ref=e74] [cursor=pointer]
        - region "Главные цифры" [ref=e75]:
          - generic [ref=e76]:
            - generic [ref=e77]: Под риском дефицита
            - 'link "Под риском дефицита: открыть" [ref=e82] [cursor=pointer]':
              - /url: /opus_a/replenishment
          - generic [ref=e83]: Ждут вашего решения
          - generic [ref=e87]:
            - generic [ref=e88]: Стоимость рекомендаций
            - generic [ref=e89]: 67 763 248 ₸
            - generic [ref=e90]: "IEK: себестоимость не задана"
          - generic [ref=e91]: Агенты сделали сами
        - generic [ref=e95]:
          - generic [ref=e96]:
            - region [ref=e97]:
              - generic [ref=e98]:
                - heading "Ждут вашего решения 14" [level=2] [ref=e99]:
                  - text: Ждут вашего решения
                  - generic [ref=e100]: "14"
                - generic [ref=e101]: Агенты ничего не отправляют без вашего решения
              - list [ref=e102]:
                - listitem [ref=e103]:
                  - generic [ref=e110]:
                    - 'heading "Заказ поставщику SE: 294 позиций" [level=3] [ref=e111]'
                    - paragraph [ref=e112]: "Заказ SE: 294 позиций, 67753 шт. Стоимость известна для 262 из 294 позиций; неизвестные цены требуют проверки. Подтвердите точный состав и количество перед передачей."
                    - generic [ref=e113]:
                      - generic [ref=e114]: ждёт вас
                      - generic [ref=e115]: 294 источника · с 23 сент., 04:02
                  - generic [ref=e116]:
                    - strong [ref=e117]: 67 763 248 ₸
                    - generic [ref=e118]: известная стоимость
                  - generic [ref=e119]:
                    - button "Решить…" [ref=e120] [cursor=pointer]
                    - link "Проверить количества" [ref=e121] [cursor=pointer]:
                      - /url: /opus_a/replenishment?supplier=SE
                - listitem [ref=e122]:
                  - generic [ref=e128]:
                    - 'heading "Проверить отсутствующие источники IEK: 500 SKU" [level=3] [ref=e129]'
                    - paragraph [ref=e130]: "Нет свежего остатка по 500 SKU — проверьте склад перед заказом. Например: 010300125_ — остаток на фев 2025; 010300127_ — остаток на янв 2026; 010300130_ — остаток на май 2026."
                    - generic [ref=e131]:
                      - generic [ref=e132]: Нужна ваша проверка
                      - generic [ref=e133]: 500 источников · с 23 сент., 02:54
                  - link "Открыть проверку" [ref=e135] [cursor=pointer]:
                    - /url: /review/TK-51d16491-f6aa-409a-b40f-3b506c5cb0e3
                - listitem [ref=e136]:
                  - generic [ref=e142]:
                    - 'heading "Проверить отсутствующие источники SE: 38 SKU" [level=3] [ref=e143]'
                    - paragraph [ref=e144]: "Нет свежего остатка по 38 SKU — проверьте склад перед заказом. Например: 030200008_ — остаток на янв 2026; 030200029_ — остаток на май 2026; 030200030_ — остаток на июл 2026."
                    - generic [ref=e145]:
                      - generic [ref=e146]: Нужна ваша проверка
                      - generic [ref=e147]: 38 источников · с 23 сент., 02:54
                  - link "Открыть проверку" [ref=e149] [cursor=pointer]:
                    - /url: /review/TK-006a8034-e330-41dc-b77a-f1a2a72ac8a5
                - listitem [ref=e150]:
                  - generic [ref=e156]:
                    - 'heading "Проверить отсутствующие источники IEK: 500 SKU" [level=3] [ref=e157]'
                    - paragraph [ref=e158]: "Нет свежего остатка по 500 SKU — проверьте склад перед заказом. Например: 010300125_ — остаток на фев 2025; 010300127_ — остаток на янв 2026; 010300130_ — остаток на май 2026."
                    - generic [ref=e159]:
                      - generic [ref=e160]: Нужна ваша проверка
                      - generic [ref=e161]: 500 источников · с 23 сент., 03:24
                  - link "Открыть проверку" [ref=e163] [cursor=pointer]:
                    - /url: /review/TK-3b20570b-928a-4411-ad89-ddf57b48fbb2
                - listitem [ref=e164]:
                  - generic [ref=e170]:
                    - 'heading "Проверить отсутствующие источники SE: 38 SKU" [level=3] [ref=e171]'
                    - paragraph [ref=e172]: "Нет свежего остатка по 38 SKU — проверьте склад перед заказом. Например: 030200008_ — остаток на янв 2026; 030200029_ — остаток на май 2026; 030200030_ — остаток на июл 2026."
                    - generic [ref=e173]:
                      - generic [ref=e174]: Нужна ваша проверка
                      - generic [ref=e175]: 38 источников · с 23 сент., 03:24
                  - link "Открыть проверку" [ref=e177] [cursor=pointer]:
                    - /url: /review/TK-4f9f2fae-b99d-4e70-9911-c8a9665114d1
                - listitem [ref=e178]:
                  - generic [ref=e184]:
                    - 'heading "Проверить отсутствующие источники SE: 38 SKU" [level=3] [ref=e185]'
                    - paragraph [ref=e186]: "Нет свежего остатка по 38 SKU — проверьте склад перед заказом. Например: 030200008_ — остаток на янв 2026; 030200029_ — остаток на май 2026; 030200030_ — остаток на июл 2026."
                    - generic [ref=e187]:
                      - generic [ref=e188]: Нужна ваша проверка
                      - generic [ref=e189]: 38 источников · с 23 сент., 03:47
                  - link "Открыть проверку" [ref=e191] [cursor=pointer]:
                    - /url: /review/TK-9132e177-ae1f-4232-9162-cc4784358e05
                - listitem [ref=e192]:
                  - generic [ref=e198]:
                    - 'heading "Проверить отсутствующие источники SE: 38 SKU" [level=3] [ref=e199]'
                    - paragraph [ref=e200]: "Нет свежего остатка по 38 SKU — проверьте склад перед заказом. Например: 030200008_ — остаток на янв 2026; 030200029_ — остаток на май 2026; 030200030_ — остаток на июл 2026."
                    - generic [ref=e201]:
                      - generic [ref=e202]: Нужна ваша проверка
                      - generic [ref=e203]: 38 источников · с 23 сент., 03:53
                  - link "Открыть проверку" [ref=e205] [cursor=pointer]:
                    - /url: /review/TK-0307ef25-a556-41d4-b9b2-76744d65b9c0
                - listitem [ref=e206]:
                  - generic [ref=e212]:
                    - 'heading "Проверить отсутствующие источники SE: 38 SKU" [level=3] [ref=e213]'
                    - paragraph [ref=e214]: "Нет свежего остатка по 38 SKU — проверьте склад перед заказом. Например: 030200008_ — остаток на янв 2026; 030200029_ — остаток на май 2026; 030200030_ — остаток на июл 2026."
                    - generic [ref=e215]:
                      - generic [ref=e216]: Нужна ваша проверка
                      - generic [ref=e217]: 38 источников · с 23 сент., 03:54
                  - link "Открыть проверку" [ref=e219] [cursor=pointer]:
                    - /url: /review/TK-a0cc62b6-2bda-4dd6-b1e6-cfffc6bc600d
                - listitem [ref=e220]:
                  - generic [ref=e226]:
                    - 'heading "Проверить отсутствующие источники IEK: 500 SKU" [level=3] [ref=e227]'
                    - paragraph [ref=e228]: "Нет свежего остатка по 500 SKU — проверьте склад перед заказом. Например: 010300125_ — остаток на фев 2025; 010300127_ — остаток на янв 2026; 010300130_ — остаток на май 2026."
                    - generic [ref=e229]:
                      - generic [ref=e230]: Нужна ваша проверка
                      - generic [ref=e231]: 500 источников · с 23 сент., 03:54
                  - link "Открыть проверку" [ref=e233] [cursor=pointer]:
                    - /url: /review/TK-ddb4eae5-cf5b-4611-b099-2d0f7e6b4ad8
                - listitem [ref=e234]:
                  - generic [ref=e240]:
                    - 'heading "Проверить отсутствующие источники IEK: 500 SKU" [level=3] [ref=e241]'
                    - paragraph [ref=e242]: "Нет свежего остатка по 500 SKU — проверьте склад перед заказом. Например: 010300125_ — остаток на фев 2025; 010300127_ — остаток на янв 2026; 010300130_ — остаток на май 2026."
                    - generic [ref=e243]:
                      - generic [ref=e244]: Нужна ваша проверка
                      - generic [ref=e245]: 500 источников · с 23 сент., 03:59
                  - link "Открыть проверку" [ref=e247] [cursor=pointer]:
                    - /url: /review/TK-ce812a4f-1fe6-4af6-abcf-6da14b3bc699
                - listitem [ref=e248]:
                  - generic [ref=e254]:
                    - 'heading "Проверить отсутствующие источники SE: 38 SKU" [level=3] [ref=e255]'
                    - paragraph [ref=e256]: "Нет свежего остатка по 38 SKU — проверьте склад перед заказом. Например: 030200008_ — остаток на янв 2026; 030200029_ — остаток на май 2026; 030200030_ — остаток на июл 2026."
                    - generic [ref=e257]:
                      - generic [ref=e258]: Нужна ваша проверка
                      - generic [ref=e259]: 38 источников · с 23 сент., 03:59
                  - link "Открыть проверку" [ref=e261] [cursor=pointer]:
                    - /url: /review/TK-560f3e3f-f038-4423-b33a-d9a42a3e5185
                - listitem [ref=e262]:
                  - generic [ref=e269]:
                    - 'heading "Заказ поставщику IEK: 965 позиций" [level=3] [ref=e270]'
                    - paragraph [ref=e271]: "Заказ IEK: 965 позиций, 288172 шт. Стоимость известна для 0 из 965 позиций; неизвестные цены требуют проверки. Подтвердите точный состав и количество перед передачей."
                    - generic [ref=e272]:
                      - generic [ref=e273]: ждёт вас
                      - generic [ref=e274]: 965 источников · с 23 сент., 04:02
                  - generic [ref=e275]:
                    - generic [ref=e276]: себестоимость не задана
                    - generic [ref=e277]: известная стоимость
                  - generic [ref=e278]:
                    - button "Решить…" [ref=e279] [cursor=pointer]
                    - link "Проверить количества" [ref=e280] [cursor=pointer]:
                      - /url: /opus_a/replenishment?supplier=IEK
                - listitem [ref=e281]:
                  - generic [ref=e287]:
                    - 'heading "Проверить отсутствующие источники IEK: 500 SKU" [level=3] [ref=e288]'
                    - paragraph [ref=e289]: "Нет свежего остатка по 500 SKU — проверьте склад перед заказом. Например: 010300125_ — остаток на фев 2025; 010300127_ — остаток на янв 2026; 010300130_ — остаток на май 2026."
                    - generic [ref=e290]:
                      - generic [ref=e291]: Нужна ваша проверка
                      - generic [ref=e292]: 500 источников · с 23 сент., 04:02
                  - link "Открыть проверку" [ref=e294] [cursor=pointer]:
                    - /url: /review/TK-6677353c-d6c8-498c-940f-01e543be72fd
                - listitem [ref=e295]:
                  - generic [ref=e301]:
                    - 'heading "Проверить отсутствующие источники SE: 38 SKU" [level=3] [ref=e302]'
                    - paragraph [ref=e303]: "Нет свежего остатка по 38 SKU — проверьте склад перед заказом. Например: 030200008_ — остаток на янв 2026; 030200029_ — остаток на май 2026; 030200030_ — остаток на июл 2026."
                    - generic [ref=e304]:
                      - generic [ref=e305]: Нужна ваша проверка
                      - generic [ref=e306]: 38 источников · с 23 сент., 04:02
                  - link "Открыть проверку" [ref=e308] [cursor=pointer]:
                    - /url: /review/TK-65e24e63-c492-4598-be4e-a1d77fbf00f1
            - region [ref=e309]:
              - heading "Подготовленные заказы" [level=2] [ref=e310]
              - article [ref=e311]:
                - generic [ref=e312]:
                  - heading "Заказ · SE" [level=3] [ref=e313]
                  - generic [ref=e314]: Утверждён
                - generic [ref=e315]:
                  - strong [ref=e316]: 67 763 248 ₸
                  - generic [ref=e317]: 294 позиций · 67 753 шт · ожидается 12 нояб. 2026
                - paragraph [ref=e318]: Цена известна для 262 из 294 позиций. Сумма неполная. Поставщику не отправлен.
                - group [ref=e319]:
                  - generic "Состав заказа" [ref=e320] [cursor=pointer]
                - generic [ref=e321]:
                  - generic [ref=e322]: Экспорт для 1С · поле «Код 1с»
                  - link "CSV" [ref=e323] [cursor=pointer]:
                    - /url: /api/orders/PO-6c74b444-aef0-429a-8c44-403f90d388b9/export.csv
                  - link "XLSX" [ref=e327] [cursor=pointer]:
                    - /url: /api/orders/PO-6c74b444-aef0-429a-8c44-403f90d388b9/export.xlsx
              - article [ref=e331]:
                - generic [ref=e332]:
                  - heading "Заказ · SE" [level=3] [ref=e333]
                  - generic [ref=e334]: Утверждён
                - generic [ref=e335]:
                  - strong [ref=e336]: 67 763 248 ₸
                  - generic [ref=e337]: 294 позиций · 67 753 шт · ожидается 12 нояб. 2026
                - paragraph [ref=e338]: Цена известна для 262 из 294 позиций. Сумма неполная. Поставщику не отправлен.
                - group [ref=e339]:
                  - generic "Состав заказа" [ref=e340] [cursor=pointer]
                - generic [ref=e341]:
                  - generic [ref=e342]: Экспорт для 1С · поле «Код 1с»
                  - link "CSV" [ref=e343] [cursor=pointer]:
                    - /url: /api/orders/PO-ac130249-5f36-4319-b6c4-85d9ab6e448f/export.csv
                  - link "XLSX" [ref=e347] [cursor=pointer]:
                    - /url: /api/orders/PO-ac130249-5f36-4319-b6c4-85d9ab6e448f/export.xlsx
              - article [ref=e351]:
                - generic [ref=e352]:
                  - heading "Заказ · SE" [level=3] [ref=e353]
                  - generic [ref=e354]: Утверждён
                - generic [ref=e355]:
                  - strong [ref=e356]: 67 763 248 ₸
                  - generic [ref=e357]: 294 позиций · 67 753 шт · ожидается 12 нояб. 2026
                - paragraph [ref=e358]: Цена известна для 262 из 294 позиций. Сумма неполная. Поставщику не отправлен.
                - group [ref=e359]:
                  - generic "Состав заказа" [ref=e360] [cursor=pointer]
                - generic [ref=e361]:
                  - generic [ref=e362]: Экспорт для 1С · поле «Код 1с»
                  - link "CSV" [ref=e363] [cursor=pointer]:
                    - /url: /api/orders/PO-c4afa1fc-445b-4f5d-a2e7-cfcceeffe256/export.csv
                  - link "XLSX" [ref=e367] [cursor=pointer]:
                    - /url: /api/orders/PO-c4afa1fc-445b-4f5d-a2e7-cfcceeffe256/export.xlsx
              - article [ref=e371]:
                - generic [ref=e372]:
                  - heading "Заказ · SE" [level=3] [ref=e373]
                  - generic [ref=e374]: Утверждён
                - generic [ref=e375]:
                  - strong [ref=e376]: 67 763 248 ₸
                  - generic [ref=e377]: 294 позиций · 67 753 шт · ожидается 12 нояб. 2026
                - paragraph [ref=e378]: Цена известна для 262 из 294 позиций. Сумма неполная. Поставщику не отправлен.
                - group [ref=e379]:
                  - generic "Состав заказа" [ref=e380] [cursor=pointer]
                - generic [ref=e381]:
                  - generic [ref=e382]: Экспорт для 1С · поле «Код 1с»
                  - link "CSV" [ref=e383] [cursor=pointer]:
                    - /url: /api/orders/PO-cd0e8547-5f96-46b3-a752-44cff976190a/export.csv
                  - link "XLSX" [ref=e387] [cursor=pointer]:
                    - /url: /api/orders/PO-cd0e8547-5f96-46b3-a752-44cff976190a/export.xlsx
            - region [ref=e391]:
              - generic [ref=e392]:
                - heading "Риск дефицита" [level=2] [ref=e393]
                - link "Все рекомендации" [ref=e394] [cursor=pointer]:
                  - /url: /opus_a/replenishment
              - list [ref=e395]:
                - listitem [ref=e396]
                - listitem [ref=e399]
                - listitem [ref=e402]
                - listitem [ref=e405]
          - complementary "Деньги и агенты" [ref=e408]:
            - region [ref=e409]:
              - heading "Деньги" [level=2] [ref=e410]
              - generic [ref=e411]:
                - generic [ref=e412]:
                  - generic [ref=e413]: Обязательства · SE
                  - generic [ref=e414]: 271 052 993 ₸
                  - generic [ref=e415]: 1 176 строк · цена известна для 1 048
                - generic [ref=e416]:
                  - generic [ref=e417]: Выплата
                  - generic [ref=e418]: −20 328 975 ₸
                  - generic [ref=e419]: 23 сент. 2026
                - generic [ref=e420]:
                  - generic [ref=e421]: Выплата
                  - generic [ref=e422]: −20 328 975 ₸
                  - generic [ref=e423]: 23 сент. 2026
                - generic [ref=e424]:
                  - generic [ref=e425]: Выплата
                  - generic [ref=e426]: −20 328 975 ₸
                  - generic [ref=e427]: 23 сент. 2026
                - generic [ref=e428]:
                  - generic [ref=e429]: Выплата
                  - generic [ref=e430]: −20 328 975 ₸
                  - generic [ref=e431]: 23 сент. 2026
                - generic [ref=e432]:
                  - generic [ref=e433]: Стоимость запаса
                  - generic [ref=e434]: 144 117 721 ₸
                  - generic [ref=e435]: себестоимость известна для 13 % позиций
                - generic [ref=e438]:
                  - generic [ref=e439]: Себестоимость не задана
                  - generic [ref=e440]: 3 417
                - generic [ref=e441]:
                  - generic [ref=e442]: Начальный остаток денег не задан
                  - generic [ref=e443]: "1"
            - region [ref=e444]:
              - generic [ref=e445]:
                - heading "Что сделали агенты" [level=2] [ref=e446]
                - generic "Agents · partner data" [ref=e447]: Агенты · данные партнёра
              - list "Журнал агентов" [ref=e448]:
                - listitem [ref=e449]:
                  - generic [ref=e451]:
                    - generic [ref=e452]: Требуются данные для 38 SKU SE
                    - generic [ref=e453]: ждёт вас
                  - time [ref=e454]: 04:02
                - listitem [ref=e455]:
                  - generic [ref=e457]:
                    - generic [ref=e458]: "Создана задача: Проверить отсутствующие источники SE: 38 SKU"
                    - generic [ref=e459]: сам
                  - time [ref=e460]: 04:02
                - listitem [ref=e461]:
                  - generic [ref=e463]:
                    - generic [ref=e464]: Требуются данные для 500 SKU IEK
                    - generic [ref=e465]: ждёт вас
                  - time [ref=e466]: 04:02
                - listitem [ref=e467]:
                  - generic [ref=e469]:
                    - generic [ref=e470]: "Создана задача: Проверить отсутствующие источники IEK: 500 SKU"
                    - generic [ref=e471]: сам
                  - time [ref=e472]: 04:02
                - listitem [ref=e473]:
                  - generic [ref=e475]:
                    - generic [ref=e476]: Нужно решение по заказу SE
                    - generic [ref=e477]: ждёт вас
                  - time [ref=e478]: 04:02
                - listitem [ref=e479]:
                  - generic [ref=e481]:
                    - generic [ref=e482]: Создана задача проверить заказ SE
                    - generic [ref=e483]: сам
                  - time [ref=e484]: 04:02
                - listitem [ref=e485]:
                  - generic [ref=e487]:
                    - generic [ref=e488]: "Подготовлены рекомендации SE: 294 позиций"
                    - generic [ref=e489]: сам
                  - time [ref=e490]: 04:02
                - listitem [ref=e491]:
                  - generic [ref=e493]:
                    - generic [ref=e494]: Нужно решение по заказу IEK
                    - generic [ref=e495]: ждёт вас
                  - time [ref=e496]: 04:02
                - listitem [ref=e497]:
                  - generic [ref=e499]:
                    - generic [ref=e500]: Создана задача проверить заказ IEK
                    - generic [ref=e501]: сам
                  - time [ref=e502]: 04:02
                - listitem [ref=e503]:
                  - generic [ref=e505]:
                    - generic [ref=e506]: "Подготовлены рекомендации IEK: 965 позиций"
                    - generic [ref=e507]: сам
                  - time [ref=e508]: 04:02
                - listitem [ref=e509]:
                  - generic [ref=e511]:
                    - generic [ref=e512]: Предложение PR-2914392b-e1f5-439f-88ed-b17a1385b968 заменено новой версией PR-5de33664-ae07-47da-b4b0-124c565b7cab
                    - generic [ref=e513]: сам
                  - time [ref=e514]: 04:02
                - listitem [ref=e515]:
                  - generic [ref=e517]:
                    - generic [ref=e518]: "Пересчитана потребность щщщ0116254: 0 шт"
                    - generic [ref=e519]:
                      - text: сам ·
                      - link "щщщ0116254" [ref=e520] [cursor=pointer]:
                        - /url: /opus_a/skus/%D1%89%D1%89%D1%890116254?from=%2Fopus_a%2Ftoday
                  - time [ref=e521]: 04:02
              - generic [ref=e522]: 16 189 сами · 28 ждут вас
            - generic [ref=e526]: Экспорт для 1С (файл) — после утверждения заказа.
  - button "Open Next.js Dev Tools" [ref=e535] [cursor=pointer]
  - alert [ref=e539]
```

# Test source

```ts
  1   | import { test, expect, type Page } from "@playwright/test";
  2   | import { readFile } from "node:fs/promises";
  3   | import * as XLSX from "xlsx";
  4   | 
  5   | const BASE = process.env.OPUS_A_URL ?? "http://localhost:3111";
  6   | const OUT = "docs/evidence/opus_a/astra";
  7   | const SKU = "130200122_";
  8   | const views = [{ name: "desktop", width: 1440, height: 900 }, { name: "phone", width: 390, height: 844 }];
> 9   | async function ready(page: Page) { await expect(page.locator(".oa-skel")).toHaveCount(0, { timeout: 20_000 }); await page.evaluate(() => document.fonts.ready); }
      |                                                                           ^ Error: expect(locator).toHaveCount(expected) failed
  10  | async function shot(page: Page, name: string, fullPage = false) {
  11  |   await page.locator('img').evaluateAll(images => Promise.race([Promise.all(images.map(image => { (image as HTMLImageElement).loading = 'eager'; return (image as HTMLImageElement).decode().catch(() => {}); })), new Promise(resolve => setTimeout(resolve, 2000))]));
  12  |   await page.screenshot({ path: `${OUT}/${name}.png`, fullPage });
  13  | }
  14  | async function noOverflow(page: Page) {
  15  |   expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  16  |   const overflowing = await page.locator('.oa-table,.oa-rail,.oa-tabs').evaluateAll(nodes => nodes.filter(node => node.scrollWidth > node.clientWidth + 2).map(node => node.className));
  17  |   expect(overflowing).toEqual([]);
  18  | }
  19  | async function openFirstRow(page: Page) {
  20  |   const row = page.locator('[data-row-toggle]').first();
  21  |   if (await row.getAttribute('aria-expanded') !== 'true') await row.click();
  22  |   await expect(page.locator('.oa-why')).toBeVisible();
  23  | }
  24  | 
  25  | test.describe.configure({ mode: 'default' });
  26  | for (const viewport of views) {
  27  |   test(`${viewport.name}: three populated screens, reflow and rationale`, async ({ page }) => {
  28  |     const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  29  |     await page.setViewportSize(viewport);
  30  |     for (const [name, path] of [['today', 'today'], ['replenishment', 'replenishment?supplier=SE'], ['sku', `skus/${SKU}`]]) {
  31  |       await page.goto(`${BASE}/opus_a/${path}`); await ready(page);
  32  |       await page.evaluate(() => window.scrollTo(0, 0));
  33  |       await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  34  |       if (viewport.name === 'phone') await noOverflow(page);
  35  |       await shot(page, `after-${name}-${viewport.name}`);
  36  |       await shot(page, `after-${name}-${viewport.name}-full`, true);
  37  |       if (name === 'replenishment') {
  38  |         await openFirstRow(page);
  39  |         await page.locator('.oa-why').scrollIntoViewIfNeeded();
  40  |         await shot(page, `rationale-${viewport.name}`);
  41  |         if (viewport.name === 'phone') await noOverflow(page);
  42  |         await expect(page.getByText('Изменение количества пока недоступно')).toBeVisible();
  43  |         await shot(page, `adjust-unavailable-${viewport.name}`);
  44  |       }
  45  |     }
  46  |     expect(errors).toEqual([]);
  47  |   });
  48  | }
  49  | 
  50  | test('search: code, article, name; keyboard, empty and unavailable', async ({ page }) => {
  51  |   await page.goto(`${BASE}/opus_a/today`); await ready(page);
  52  |   const search = page.getByRole('combobox', { name: 'Поиск товара' });
  53  |   for (const term of [SKU, 'YNN10-812-10DP-K07', 'Шина']) {
  54  |     await page.keyboard.press('Meta+k'); await expect(search).toBeFocused();
  55  |     await search.fill(term); await expect(page.getByRole('option').first()).toBeVisible();
  56  |     await expect(page.locator('.oa-results')).toContainText(term === 'Шина' ? 'Шина' : SKU);
  57  |   }
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
```