# Отдельные обёртки для некоторых топиков

Необходимо заменить начальную часть скрипта на это:

```js
<script id="efof">
/** СКРИПТ ИЗМЕНЕНИЯ БАЛАНСА СО СТРАНИЦЫ БАНКА
 https://github.com/4eDo/mybb/blob/main/edit_field_on_fly/readme.md
  Версия от 2024-11-01
**/
const FIELD_ID_FOR_EDIT = "fld4";
const ADD_CACHE_TEXT = "Изменение баланса";
const COLOR_INPUT_TEXT = "";
const ALLOWED_TOPICS = ['9', '10', '66', '1695', '1635', '1359', '1887', '1932']; // С кавычками
const ALLOWED_TOPICS_CUSTOM = ['1932']; // группы отсюда должны содержаться и в верхнем списке.
const CURRENT_TOPIC_ID_TEMP = new URLSearchParams(window.location.search).get('id');
const CURRENT_IS_CUSTOM = ALLOWED_TOPICS_CUSTOM.includes(CURRENT_TOPIC_ID_TEMP);
const ALLOWED_GROUPS = [1, 2]; // БЕЗ кавычек

const OPERATIONS = [ // Наименование опции, коэффициент, в каких топиках есть (через пробел) или all
  ["Начисление", "1", "all"],
  ["Списание", "-1", "all"],
  ["Начисление", "100", "1932"],
 
];
const ROUND = 0; // Если допускается дробный баланс, укажите кол-во знаков после запятой
// if 0 then 0.5555555 -> 0    1.999 -> 1
// if 1 then 0.5555555 -> 0.6
// if 2 then 0.5555555 -> 0.56
// if 3 then 0.5555555 -> 0.556

const USE_WRAPPER = true; // false, если не хотите, чтобы сообщение как-то помечалось

// шаблон, по которому оборачивается пост.
// {{ADMIN_NAME}} - имя админа
// {{CACHE_BEFORE}} - баланс до изменения
// {{CACHE_AFTER}} - баланс после изменения
const WRAPPER_CUSTOM = {
  '1932': [ // id топика (один!!!)
    ``, // кастомное начало
    `[align=right]+100$[/align]` // кастомный конец
  ],

  
}
const WRAPPER_START = 
  CURRENT_IS_CUSTOM
  ? WRAPPER_CUSTOM[CURRENT_TOPIC_ID_TEMP][0]
  : `[spoiler="[table layout=auto width=100]
[tr]
[td][b]ОБРАБОТАНО[/b] ({{ADMIN_NAME}})[/td]
[td][b]Было[/b]: {{CACHE_BEFORE}}[/td]
[td][b]Стало[/b]: {{CACHE_AFTER}}[/td]
[/tr]
[/table]"]`;
const WRAPPER_END = 
  CURRENT_IS_CUSTOM
  ? WRAPPER_CUSTOM[CURRENT_TOPIC_ID_TEMP][1]
  : `[/spoiler]`;
```
