# Visual Tuner

Локальный инструмент для финальной визуальной доводки уже готовых HTML/CSS-сайтов. Он не меняет исходный сайт: workspace, история и итоговый CSS хранятся в `workspaces/` рядом с инструментом.

## Быстрый запуск

- Дважды кликните `Visual Tuner.command`, выберите папку сайта с `index.html`.
- Или передайте папку в Terminal:

  ```bash
  ./Visual\ Tuner.command "/path/to/site"
  ```

Для сайтов, уже запущенных локально (Vite, Next и т.д.):

```bash
python3 visual_tuner.py --url http://127.0.0.1:5173
```

## Как это работает

Открывшийся интерфейс показывает настоящий сайт в iframe. Кликайте элементы в предпросмотре — справа появятся их текущие computed CSS values. `Shift` + клик выбирает ближайшую секцию, `Alt` + клик оставляет обычное действие сайта. Изменения применяются мгновенно, а **Save** сохраняет их отдельно:

- `workspaces/<site>/changes.json` — правила и выбранные breakpoint;
- `workspaces/<site>/overrides.css` — чистый CSS для переноса в основной stylesheet.

Используйте переключатель **Original / Edited**, чтобы мгновенно скрыть или вернуть все overrides. Copy CSS копирует тот же итоговый CSS в буфер, Export CSS скачивает файл.

## Границы первой версии

Инструмент поддерживает точную настройку typography, spacing, size, colours, image fit/position, border, z-index и основных flex/grid-свойств для Desktop, Tablet и Mobile. Свободного перетаскивания обычных элементов нет: оно часто разрушает responsive layout. Для уже позиционируемых декораций используйте `top/right/bottom/left` в разделе Position.

В URL-режиме проксируются обычные HTTP-ресурсы. Hot reload через WebSocket пока не проксируется — после обновления исходного сайта просто обновите предпросмотр.
