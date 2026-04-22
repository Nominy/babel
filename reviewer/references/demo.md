```prompt
SYSTEM:
You are a transcript issue classifier for Babel Audio.
Select template IDs for issues that are clearly supported by the provided diffs.

How to use the payload:
- localTextEvidence is the text-preserving local packet. Use it for Tags & Emphasis, Punctuation & Formatting, and local text-change context.
- localTextEvidence.changedPairs are simple before/after row pairs intended for text-level debugging, not authoritative segmentation evidence.
- babelDiff.segmentation is the official Babel source for split/merge/add/delete and other segmentation judgments.
- babelDiff.segmentation.samples include exact reference/hypothesis member segments, timings, word ranges, and changed tokens for each structural mapping.
- babelDiff.timestamp is the official Babel source for timestamp precision, segment matching, and shift severity.
- babelDiff.wordAccuracy is useful for word-error evidence and per-speaker breakdowns, but Babel aligned text may omit or flatten tags.
- Do not use babelDiff alone to judge Tags & Emphasis.
- Do not expect severity labels, scores, or pre-labeled text categories.

Selection rules:
1. Return only template IDs from the provided catalog.
2. Do not invent IDs.
3. Do not return duplicate IDs.
4. findings may be an empty array.
5. If the text diffs show a language-level issue, choose the matching text template yourself.
5a. For Segmentation and Timestamp Accuracy, use official babelDiff evidence when present.
5aa. For split/merge/add/delete judgments, rely on babelDiff.segmentation.samples member segments and timings, not just summary counts.
5b. For Tags & Emphasis, prefer localTextEvidence because Babel diff may strip tags from aligned text.
5c. For Word Accuracy, use babelDiff.wordAccuracy plus localTextEvidence.changedPairs when helpful.
5d. Do not infer segmentation problems from local row pairing alone.
6. Prefer the most specific template that fully explains the evidence.
7. Do not return a broad generic template when a more specific template already explains the same local diff.
8. Generic punctuation templates are fallback-only: do not combine them with dedicated tag or service-markup templates unless there is separate independent punctuation evidence elsewhere.

Output rules:
- Return strict JSON only. No markdown. No prose outside JSON.
- Use exactly this schema:
{"findings":["word_accuracy.example_issue"]}

USER:
Review the focused diff packet and choose all matching issue templates.

Focused diff packet:
{
  "session": {
    "actionId": "f5542228-85ea-473f-b903-aebb79eea2d2",
    "metricsVersion": "v5",
    "promptVersion": "v9"
  },
  "overview": {
    "originalSegments": 15,
    "currentSegments": 15,
    "originalWords": 305,
    "currentWords": 308,
    "segmentCountDelta": 0,
    "localTextChangeCount": 7,
    "localTagChangeCount": 0,
    "hasBabelDiff": true
  },
  "localTextEvidence": {
    "changedPairs": [
      {
        "before": "Мгм, а-а, хочу начать с перевода. Мм, я часто, ну, переводы, конечно, бывают разными, мм, но часто, мм, дается поработать пе- переводчиком, устным переводчиком, э-э, с иммигрантами. Мм, то есть, э, меня зовут на коллекти...",
        "after": "Мгм, а-а, хочу начать с перевода. Мм, я часто-- ну, переводы, конечно, бывают разными, мм, но часто, мм, дается поработать пе- переводчиком, устным переводчиком, а-а, с иммигрантами. Мм, то есть, э, меня зовут на коллект...",
        "beforeTagCount": 0,
        "afterTagCount": 0
      },
      {
        "before": "Такой получается коллективный урок, который длится весь день - с 9 {СКАЗ: девяти} утра до 5 {СКАЗ: пяти} с перерывом. Э-э, мм, урок на французском, и нужно переводить, э-э, на русский язык, э-э, участникам. То есть, э-э,...",
        "after": "Такой получается коллективный урок, который длится весь день - с 9 {СКАЗ: девяти} утра до 5 {СКАЗ: пяти} с перерывом. Эм, урок на французском, и нужно переводить, э-э, на русский язык, э, участникам. То есть, а-а, группа...",
        "beforeTagCount": 2,
        "afterTagCount": 2
      },
      {
        "before": "То- то есть, мгм, мгм, как бы,э-э, они учатся тоже переводить или они просто получают эту информацию через твой перевод?",
        "after": "То- то есть-- мгм- мгм, как бы, а-а, они учатся тоже переводить или они просто получают эту информацию через твой перевод?",
        "beforeTagCount": 0,
        "afterTagCount": 0
      },
      {
        "before": "Они просто получают информацию. Это, э-э, иммигранты, эм, и они проходят обучение, по-- по-- гражданское обучению во Франции. То есть им объясняют, как работает ад- административная система во Франции. Э, ну и я вот это ...",
        "after": "Они просто получают информацию. Это, м, э, иммигранты, эм, и они проходят обучение, по- по-- гражданское обучению во Франции. То есть им объясняют, как работает ад- административная система во Франции. Э, ну и я вот это ...",
        "beforeTagCount": 0,
        "afterTagCount": 0
      },
      {
        "before": "Ага, все поняла, мгм.",
        "after": "Ага, всё поняла, мгм.",
        "beforeTagCount": 0,
        "afterTagCount": 0
      },
      {
        "before": "Да. Мгм, я очень, э, серьезно подхожу к своей работе, эм, не позволяю себе, ну то есть это можно даже сказать в каком-то смысле физическая работа о- очень утомительная, потому что нужно весь день, эм, быть начеку, а, слу...",
        "after": "Да. Мгм, я очень, э, серьезно подхожу к своей работе, эм, не позволяю себе-- ну, то есть это можно даже сказать в каком-то смысле физическая работа о- очень утомительная, потому что нужно весь день, ам, быть начеку, а, с...",
        "beforeTagCount": 1,
        "afterTagCount": 1
      },
      {
        "before": "Иногда, иногда большая, мгм, иногда большая иногда иногда поменьше, но в любом случае, э-э, как бы тоже, мм, многосторонняя работа получается и тут и- и там и перерывы, и не знаю что много че-- всего происходит.",
        "after": "Иногда, иногда большая-- мгм, иногда большая иногда иногда поменьше, но в любом случае, э-э, как бы тоже, мм, многосторонняя работа получается и тут и- и там и перерывы, и не знаю, что - много че-- всего происходит.",
        "beforeTagCount": 0,
        "afterTagCount": 0
      }
    ],
    "originalTagSamples": [
      {
        "id": "5b056004-5e67-45eb-a209-843d92c0a10b",
        "text": "Такой получается коллективный урок, который длится весь день - с 9 {СКАЗ: девяти} утра до 5 {СКАЗ: пяти} с перерывом. Э-э, мм, урок на французском, и нужно переводить, э-э, на русский язык, э-э, участникам. То есть, э-э,...",
        "startTimeInSeconds": 20.342,
        "endTimeInSeconds": 52.219
      },
      {
        "id": "1f923b1b-106d-4e00-bf8f-319c093e8875",
        "text": "Да. Мгм, я очень, э, серьезно подхожу к своей работе, эм, не позволяю себе, ну то есть это можно даже сказать в каком-то смысле физическая работа о- очень утомительная, потому что нужно весь день, эм, быть начеку, а, слу...",
        "startTimeInSeconds": 93.349,
        "endTimeInSeconds": 119.516
      }
    ],
    "currentTagSamples": [
      {
        "id": "5b056004-5e67-45eb-a209-843d92c0a10b",
        "text": "Такой получается коллективный урок, который длится весь день - с 9 {СКАЗ: девяти} утра до 5 {СКАЗ: пяти} с перерывом. Эм, урок на французском, и нужно переводить, э-э, на русский язык, э, участникам. То есть, а-а, группа...",
        "startTimeInSeconds": 20.342,
        "endTimeInSeconds": 52.219
      },
      {
        "id": "1f923b1b-106d-4e00-bf8f-319c093e8875",
        "text": "Да. Мгм, я очень, э, серьезно подхожу к своей работе, эм, не позволяю себе-- ну, то есть это можно даже сказать в каком-то смысле физическая работа о- очень утомительная, потому что нужно весь день, ам, быть начеку, а, с...",
        "startTimeInSeconds": 93.361,
        "endTimeInSeconds": 119.532
      }
    ],
    "originalOnlySamples": [],
    "currentOnlySamples": [],
    "originalTagSegmentCount": 2,
    "currentTagSegmentCount": 2
  },
  "babelDiff": {
    "referenceReviewActionId": "ee79fce4-ec94-4d85-8b3b-3de7774cccba",
    "currentReviewActionId": "f5542228-85ea-473f-b903-aebb79eea2d2",
    "segmentation": {
      "overview": {
        "mappingCount": 0,
        "unchangedCount": 0,
        "modifiedCount": 0,
        "splitCount": 0,
        "mergeCount": 0,
        "addedCount": 0,
        "deletedCount": 0
      },
      "samples": []
    },
    "timestamp": {
      "overview": {
        "precision": 0.9643010466307822,
        "recall": 0.9999344659747302,
        "f1": 0.9814588107343694,
        "totalSegments": 15,
        "matchedSegments": 15,
        "unmatchedSegments": 0,
        "avgShiftMs": 60.8,
        "within50ms": 53.3,
        "within100ms": 66.7,
        "within200ms": 86.7
      },
      "samples": [
        {
          "refText": "Ну да, конечно, много новых, думаю, моментов для них.",
          "startShiftMs": -174,
          "endShiftMs": 274,
          "avgShiftMs": 224,
          "quality": "poor"
        },
        {
          "refText": "Мгм.",
          "startShiftMs": -167,
          "endShiftMs": 231,
          "avgShiftMs": 199,
          "quality": "poor"
        },
        {
          "refText": "Мгм, мгм.",
          "startShiftMs": -76,
          "endShiftMs": 194,
          "avgShiftMs": 135,
          "quality": "low"
        },
        {
          "refText": "Мгм.",
          "startShiftMs": -77,
          "endShiftMs": 140,
          "avgShiftMs": 108.5,
          "quality": "low"
        },
        {
          "refText": "То- то есть-- мгм- мгм, как бы, а-а, они учатся тоже переводить или они просто получают эту информацию через твой перевод?",
          "startShiftMs": 0,
          "endShiftMs": 123,
          "avgShiftMs": 61.5,
          "quality": "low"
        },
        {
          "refText": "И группа большая, да, тоже? Ты упомянула, что много людей.",
          "startShiftMs": -100,
          "endShiftMs": 0,
          "avgShiftMs": 50,
          "quality": "medium"
        },
        {
          "refText": "Ага, всё поняла, мгм.",
          "startShiftMs": -34,
          "endShiftMs": 63,
          "avgShiftMs": 48.5,
          "quality": "medium"
        },
        {
          "refText": "Мгм, мгм.",
          "startShiftMs": -45,
          "endShiftMs": 37,
          "avgShiftMs": 41,
          "quality": "high"
        },
        {
          "refText": "Мгм, мгм.",
          "startShiftMs": -24,
          "endShiftMs": 37,
          "avgShiftMs": 30.5,
          "quality": "high"
        },
        {
          "refText": "Да. Мгм, я очень, э, серьезно подхожу к своей работе, эм, не позволяю себе-- ну, то есть это можно даже сказать в каком-то смысле физическая работа о- очень утомительная, потому что нужно весь день, ам, быть начеку, а, с...",
          "startShiftMs": -12,
          "endShiftMs": -16,
          "avgShiftMs": 14,
          "quality": "high"
        },
        {
          "refText": "Мгм, а-а, хочу начать с перевода. Мм, я часто-- ну, переводы, конечно, бывают разными, мм, но часто, мм, дается поработать пе- переводчиком, устным переводчиком, а-а, с иммигрантами. Мм, то есть, э, меня зовут на коллект...",
          "startShiftMs": 0,
          "endShiftMs": 0,
          "avgShiftMs": 0,
          "quality": "high"
        },
        {
          "refText": "Такой получается коллективный урок, который длится весь день - с 9 {СКАЗ: девяти} утра до 5 {СКАЗ: пяти} с перерывом. Эм, урок на французском, и нужно переводить, э-э, на русский язык, э, участникам. То есть, а-а, группа...",
          "startShiftMs": 0,
          "endShiftMs": 0,
          "avgShiftMs": 0,
          "quality": "high"
        }
      ]
    },
    "wordAccuracy": {
      "overview": {
        "overallWordErrorRate": 0.0502,
        "totalReferenceWords": 299,
        "totalHypothesisWords": 301,
        "totalInsertions": 4,
        "totalDeletions": 2,
        "totalSubstitutions": 9
      },
      "speakerBreakdown": [
        {
          "processedRecordingId": "speaker-1",
          "wordErrorRate": 0.0588,
          "totalReferenceWords": 51,
          "totalHypothesisWords": 52,
          "insertions": 1,
          "deletions": 0,
          "substitutions": 2
        },
        {
          "processedRecordingId": "speaker-2",
          "wordErrorRate": 0.0484,
          "totalReferenceWords": 248,
          "totalHypothesisWords": 249,
          "insertions": 3,
          "deletions": 2,
          "substitutions": 7
        }
      ],
      "wordDiffSamples": [
        {
          "processedRecordingId": "speaker-1",
          "referenceText": "Мгм. Мгм, мгм. То- то есть, мгм, мгм, как бы,э-э, они учатся тоже переводить или они просто получают эту информацию через твой перевод? Ага, все поняла, мгм. Мгм, мгм. Мгм, мгм. Ну да, конечно, много новых, думаю, момент...",
          "hypothesisText": "Мгм. Мгм, мгм. То- то есть-- мгм- мгм, как бы, а-а, они учатся тоже переводить или они просто получают эту информацию через твой перевод? Ага, всё поняла, мгм. Мгм, мгм. Мгм, мгм. Ну да, конечно, много новых, думаю, моме...",
          "changedTokens": [
            {
              "value": "бы,",
              "status": "added"
            },
            {
              "value": "бы,э-э,",
              "status": "removed"
            },
            {
              "value": "а-а,",
              "status": "added"
            },
            {
              "value": "все",
              "status": "removed"
            },
            {
              "value": "всё",
              "status": "added"
            }
          ]
        },
        {
          "processedRecordingId": "speaker-2",
          "referenceText": "Мгм, а-а, хочу начать с перевода. Мм, я часто, ну, переводы, конечно, бывают разными, мм, но часто, мм, дается поработать пе- переводчиком, устным переводчиком, э-э, с иммигрантами. Мм, то есть, э, меня зовут на коллекти...",
          "hypothesisText": "Мгм, а-а, хочу начать с перевода. Мм, я часто-- ну, переводы, конечно, бывают разными, мм, но часто, мм, дается поработать пе- переводчиком, устным переводчиком, а-а, с иммигрантами. Мм, то есть, э, меня зовут на коллект...",
          "changedTokens": [
            {
              "value": "э-э,",
              "status": "removed"
            },
            {
              "value": "а-а,",
              "status": "added"
            },
            {
              "value": "Э-э,",
              "status": "removed"
            },
            {
              "value": "мм,",
              "status": "removed"
            },
            {
              "value": "Эм,",
              "status": "added"
            },
            {
              "value": "э-э,",
              "status": "removed"
            },
            {
              "value": "э,",
              "status": "added"
            },
            {
              "value": "э-э,",
              "status": "removed"
            },
            {
              "value": "а-а,",
              "status": "added"
            },
            {
              "value": "мм,",
              "status": "removed"
            }
          ]
        }
      ]
    }
  }
}

Template catalog:
[
  {
    "category": "Word Accuracy",
    "templates": [
      {
        "id": "word_accuracy.propushchennoe_slovo",
        "description": "Слово, которое чётко слышно в аудио, не попало в транскрипцию"
      },
      {
        "id": "word_accuracy.lishnee_slovo",
        "description": "В транскрипте есть слово, которого нет в аудио (добавлено ASR или транскрибатором)"
      },
      {
        "id": "word_accuracy.omofon_nevernoe_slovo",
        "description": "Слово заменено похожим по звучанию, но с другим значением (пример: «тоже» вместо «то же»)\r\n– не смотря / несмотря\r\n– по тому / потому"
      },
      {
        "id": "word_accuracy.ochistka_rechi_razgovornye_formy",
        "description": "Разговорная форма заменена на литературную или наоборот (пример: «щас» → «сейчас»)"
      },
      {
        "id": "word_accuracy.nestandartnye_mezhdometiya",
        "description": "Междометия и филлеры написаны в нестандартной форме (пример: «эээ» вместо «э-э»)"
      },
      {
        "id": "word_accuracy.imya_sobstvennoe_brend",
        "description": "Имя, бренд или название написано неверно (неправильная капитализация, кириллица вместо латиницы)"
      },
      {
        "id": "word_accuracy.ispravlenie_po_smyslu_u2014_realnoe_slovo",
        "description": "Слово произнесено неверно, но результат — существующее слово в словаре.\r\nТранскрибатор исправил его по предполагаемому смыслу.\r\nПример: слышно «отравился» → исправлено на «оправился»"
      },
      {
        "id": "word_accuracy.razgovornaya_forma_ne_zafiksirovana",
        "description": "Спикер отчётливо произнёс сокращённую или разговорную форму, но транскрибатор записал полную литературную.\r\nПример: слышно «щас» → записано «сейчас»; слышно «чё» → записано «что»"
      },
      {
        "id": "word_accuracy.foneticheskaya_zapis_vmesto_normativnoy_reduktsiya",
        "description": "Слово произнесено с редукцией или «сглатыванием», но по контексту однозначно понятно.\r\nТранскрибатор записал фонетически вместо нормативной формы.\r\nПример: слышно «грю» → записано «грю» вместо «говорю»"
      },
      {
        "id": "word_accuracy.netipichnoe_proiznoshenie_bez_iskazh",
        "description": "Спикер намеренно произносит слово нестандартно (акцент, иностранное произношение имени).\r\nТранскрибатор записал только нормативную форму без тега.\r\nПример: «Ван Гога» вместо «Ван Гога {ИСКАЖ: Ван Го}»"
      },
      {
        "id": "word_accuracy.bolshaya_bukva_v_nachale",
        "description": "Большая буква в начале предложений, фрагмента или прямой речи не была употреблена."
      },
      {
        "id": "word_accuracy.e_yo",
        "description": "Перепутаны е и ё. Относится только к словам с двойным значением в зависимости от ёфикации."
      }
    ]
  },
  {
    "category": "Timestamp Accuracy",
    "templates": [
      {
        "id": "timestamp_accuracy.nizkiy_recall",
        "description": "Recall меньше чем 0.99"
      },
      {
        "id": "timestamp_accuracy.nizkiy_precision",
        "description": "Precision меньше чем 0.99"
      }
    ]
  },
  {
    "category": "Punctuation & Formatting",
    "templates": [
      {
        "id": "punctuation_formatting.net_znaka_kontsa_segmenta",
        "description": "В конце сегмента или предложения нет точки, ?, ! или другого завершающего знака"
      },
      {
        "id": "punctuation_formatting.dlinnoe_tire_vmesto",
        "description": "Использовано длинное тире (—) вместо двойного тире (--)"
      },
      {
        "id": "punctuation_formatting.nevernoe_oformlenie_stammera_s_defisom",
        "description": "Заикание оформлено без пробела после дефиса."
      },
      {
        "id": "punctuation_formatting.mnogotochie_dlya_pauzy",
        "description": "Многоточие использовано для обозначения паузы вместо принятого знака"
      },
      {
        "id": "punctuation_formatting.zaglavnaya_bukva_posle_obedineniya",
        "description": "После объединения сегментов в середине предложения осталась заглавная буква"
      },
      {
        "id": "punctuation_formatting.nevernoe_dvoetochie_pered_pryamoy_rechyu",
        "description": "Двоеточие перед цитатой или прямой речью поставлено неправильно или отсутствует"
      },
      {
        "id": "punctuation_formatting.zapyatye_u_mezhdometiy",
        "description": "Междометия не выделены запятыми с обеих сторон"
      },
      {
        "id": "punctuation_formatting.lishnie_probely_formatirovanie",
        "description": "Лишние пробелы, непоследовательная капитализация или смешанные стили внутри файла"
      },
      {
        "id": "punctuation_formatting.bystrye_povtory",
        "description": "Быстрые повторы слов оформлены как обычные слова через запятую, а не через дефис с пробелом"
      },
      {
        "id": "punctuation_formatting.obryv_slova_bez_dvoynogo_tire",
        "description": "Спикер оборвал слово на середине и переключился на другое, но транскрибатор не поставил --.\r\nПример: «Я хотел пойти за бул хлебом» вместо «за бул-- хлебом»"
      },
      {
        "id": "punctuation_formatting.zaikanie_oformleno_so_znakom_posle_defisa",
        "description": "После двойного тире был знак препинания. Его не должно быть. После заикания должно быть продолжение слов сразу же, без других знаков, исключение - оформление прямой речи с кавычками."
      }
    ]
  },
  {
    "category": "Tags & Emphasis",
    "templates": [
      {
        "id": "tags_emphasis.teg_na_dykhanie_bez_nagruzki",
        "description": "Обычное дыхание размечено тегом, хотя смысловой нагрузки не несёт"
      },
      {
        "id": "tags_emphasis.teg_na_fonovye_shumy",
        "description": "Фоновые звуки, не относящиеся к речи спикера, размечены тегом"
      },
      {
        "id": "tags_emphasis.propushchen_teg_nerazborchivo",
        "description": "Речь невозможно разобрать, но тег [неразборчиво] не поставлен"
      },
      {
        "id": "tags_emphasis.lishniy_teg_nerazborchivo",
        "description": "Тег [неразборчиво] поставлен там, где слово можно разобрать"
      },
      {
        "id": "tags_emphasis.dubliruyushchiesya_tegi_podryad",
        "description": "Одинаковые теги поставлены несколько раз подряд без причины"
      },
      {
        "id": "tags_emphasis.teg_ne_v_moment_sobytiya",
        "description": "Тег стоит до или после реального момента звука в аудио"
      },
      {
        "id": "tags_emphasis.teg_iskazh_postavlen_neverno",
        "description": "Тег {ИСКАЖ: } поставлен там, где слово произнесено правильно, или не поставлен там, где нужен"
      },
      {
        "id": "tags_emphasis.lozhnaya_pometa_iskazh_na_realnoe_slovo",
        "description": "Слово произнесено неверно, но является нормативным словом русского языка.\r\nТранскрибатор поставил тег {ИСКАЖ:} и исправил слово.\r\nПример: «отравился» → оправился {ИСКАЖ: отравился}"
      },
      {
        "id": "tags_emphasis.propushchen_teg_iskazh_u2014_slova_net_v_slovare",
        "description": "Слово произнесено неверно, такого слова нет в словаре, но транскрибатор записал его без тега.\r\nПример: слышно «шашими» → записано шашими (без тега)"
      },
      {
        "id": "tags_emphasis.nevernoe_primenenie_iskazh_u2014_slovo_ponyatno_po_kontekstu",
        "description": "Транскрибатор записал фонетически непонятное слово вместо того, чтобы восстановить его по контексту и поставить тег.\r\nПример: «трубавая экика» → записано как есть без исправления"
      },
      {
        "id": "tags_emphasis.propushchen_skaz",
        "description": "Тег {СКАЗ: } не был поставлен там, где нужен. Он употребляется после числительных, если они явно означают количество или порядок."
      },
      {
        "id": "tags_emphasis.lishniy_skaz",
        "description": "Тег {СКАЗ: } был поставлен в месте, где он не нужен, например, после числительного, которое является частью названия, устойчивого выражения, была произнесена с искажением или с фальш-стартом."
      },
      {
        "id": "tags_emphasis.pereputany_skaz_i_iskazh",
        "description": "Вместо {СКАЗ: } написан {ИСКАЖ: } или наоборот."
      },
      {
        "id": "tags_emphasis.zapyatyy_pri_mezhdometiyakh",
        "description": "Междометие, такое как \"ну\", \"э\", \"а,\" и др. не было обособлено."
      },
      {
        "id": "tags_emphasis.punktuatsiya_v_skaz",
        "description": "Внутри тегов {СКАЗ: } была пунктуация, дефисы."
      }
    ]
  },
  {
    "category": "Segmentation",
    "templates": [
      {
        "id": "segmentation.ne_obedineny_mashinnye_kuski",
        "description": "Машинные фрагменты одного предложения оставлены без объединения"
      },
      {
        "id": "segmentation.ne_razdelyon_pri_pauze_1_sek",
        "description": "В сегментации большой сегмент была разделен на два, по причине того, что внутри была пауза(включая или не включая дыхание) длиной больше 1 секунды"
      },
      {
        "id": "segmentation.ne_oformlen_razryv_predlozheniya",
        "description": "Предложение разорвано на границе сегмента, но -- или ... не поставлены"
      },
      {
        "id": "segmentation.registr_i_punktuatsiya_posle_obedineniya",
        "description": "После объединения сегментов не исправлен регистр букв и пунктуация"
      },
      {
        "id": "segmentation.propushchen_segment_v_audio",
        "description": "Фрагмент аудио с речью не отражён в транскрипте — сегмент пропущен"
      },
      {
        "id": "segmentation.tekst_bez_taymkoda_taymkod_bez_teksta",
        "description": "Речь отражена в тексте, но соответствующий участок аудио не выделен, или наоборот"
      },
      {
        "id": "segmentation.tegi_vne_predlozheniya",
        "description": "Вербальные звуки (смех, кашель, крик) не привязаны к предложению, не был создан отдельный сегментом без текста."
      }
    ]
  }
]
```

gemini 3.1-pro
```
{"findings":["word_accuracy.e_yo","timestamp_accuracy.nizkiy_precision","punctuation_formatting.bystrye_povtory","tags_emphasis.zapyatyy_pri_mezhdometiyakh"]}
```

gemini 3.0-flash(FAILING)
```
"findings\": [\n    \"word_accuracy.nestandartnye_mezhdometiya\",\n    \"punctuation_formatting.obryv_slova_bez_dvoynogo_tire\",\n    \"punctuation_formatting.zapyatye_u_mezhdometiy\"\n  ]\n}
```
