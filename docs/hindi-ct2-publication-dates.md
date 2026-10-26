# CT² Hindi human corpus: publication-date limitations

## Purpose

This note records the investigation into whether the human-written Hindi articles in CT² can support a pre-2021 temporal control for evaluating Hindi AI-generated text detection.

## Sources checked

- [CT² paper](https://aclanthology.org/2024.findings-emnlp.282/)
- [CT² source repository](https://github.com/ishank31/Counter_Turing_Test)
- [CT² Hindi dataset](https://huggingface.co/datasets/ishank31/CT2_AG_hi)
- [Follow-up question to the CT² authors](https://github.com/ishank31/Counter_Turing_Test/issues/2)

## Dataset composition

The available dataset contains the following human-written documents:

| Source | Human documents |
| --- | ---: |
| BBC Hindi | 1,762 |
| NDTV | 5,281 |

The human-written text is stored in the `article` field.

## Publication-date findings

The available Parquet schema does not include a publication-date field. Dates mentioned within article bodies are not reliable substitutes for publication metadata.

Therefore, the full publication-date range of the CT² Hindi human corpus cannot be established from the available metadata.

## Implication for the control dataset

A temporal split within CT² cannot currently be justified as a pre-2021 control. An independent pre-2021 Hindi dataset is needed.

A Hindi Wikipedia dump may be redistributable under CC BY-SA, subject to its attribution and share-alike requirements, but its encyclopedic register differs from the BBC Hindi and NDTV news articles. This register mismatch must be documented if it is used as a control.

The authors have been asked whether publication-date metadata or a documented collection window exists. See [CT² issue #2](https://github.com/ishank31/Counter_Turing_Test/issues/2).