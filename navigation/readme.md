# назначение
Скрипт предназначен для упрощения навигации по матчасти. Осуществляется путём перечисления ссылок и тегов к ним.

# Инструкция
Допускается размещать скрипт как на отдельной странице, так и в посте при помощи тегов `[html][/html]`.

## 1. Основной код
Для теста предлагаю сперва примерить данный код.

- В блок id="sitemap_4eDo" будут вставлены сгенерированные списки.
- Блок script содержит перечень ваших ссылок (об их заполнении в следующем пункте).
- Далее идёт подключение скрипта из репозитория на гитхабе.
- В конце подключаются стили. Можете вынести их в отдельный файл или включить к основным. В стилях можно указать и количество колонок.

``` html
<div id="sitemap_4eDo"></div>
<div id="sitemap_4eDo_links" hidden>[
  {
    "link": "https://www.example.com/link1",
    "title": "Люто важнючая информация",
    "tags": ["Карта мира", "История: битвы", "Фауна: шишуги"]
  },
  {
    "link": "https://www.example.com/link2",
    "title": "Замес, вошедший во все летописи",
    "tags": ["Расы: эльфы", "Расы: гномы", "Расы: люди", "Расы: орки", "История: битвы"]
  },
  {
    "link": "https://www.example.com/link3",
    "title": "Минутка странных фактов",
    "tags": ["Расы: эльфы", "Фауна"]
  },
  {
    "link": "https://www.example.com/link4",
    "title": "Кусок арбузной корки",
    "tags": ["Расы: эльфы", "Расы: гномы", "Расы: люди", "Расы: орки", "История: битвы", "Артефакты"]
  },
  {
    "link": "https://www.example.com/link5",
    "title": "Златые стрелы",
    "tags": ["Расы: эльфы", "Оружие"]
  },
  {
    "link": "https://www.example.com/link6",
    "title": "Лес золотой",
    "tags": ["Расы: эльфы", "Карта мира", "История: битвы", "Флора"]
  },
  {
    "link": "https://www.example.com/link7",
    "title": "Чёрный лес",
    "tags": ["Расы: орки", "Карта мира", "История: битвы", "Флора"]
  }
]</div>
	<script type="text/javascript" src="https://4edo.github.io/mybb/navigation/navigation_generator.js"></script>

<style> /* Общий блок */
#sitemap_4eDo {
  font-family: sans-serif;
  columns: 3; /* сколько колонок надо */
}

/* Основные категории */
#sitemap_4eDo .tagList {
  list-style: none;
  padding: 0;
  break-inside: avoid-column;
}

/* Внешний вид ссылок */
#sitemap_4eDo .tagItem{
  display: block;
  width: 100%;
  padding: 0px 5px;
  margin: 5px 0px;
  border: 1px solid #ccc;
  border-radius: 4px;
  transition: background-color 0.3s ease;
}
#sitemap_4eDo .tagItem:hover{
  background-color: rgba(128, 128, 128, 0.1);
}

/* Заголовки категорий и подкатегорий */
#sitemap_4eDo .tagTitle,
#sitemap_4eDo .subTitle {
  font-weight: bold;
}
/* Категории */
#sitemap_4eDo .tagTitle{
  font-size: 1.2em;
}
/* Все списки */
#sitemap_4eDo ul,
#sitemap_4eDo .tagItem {
  margin-left: 20px;
}
/* Подкатегории */
#sitemap_4eDo .subList {}</style>
```

## 2. Заполнение ссылок
Ссылки добавляются в `<div id="sitemap_4eDo_links">[]</div>`

Шаблон ссылки:
``` js
  {
    "link": "ссылка",
    "title": "Название ссылки",
    "tags": ["категория 1", "категория 2: подкатегория1", "категория: подкатегория2: подподкатегория"]
  },
```
В нём необходимо указать сам адрес ссылки, её наименование (регистр имеет значение!) и список категорий. Уровни вложенности указываются путём добавления двоеточия в категорию.
