# Bank checker & Posts counter
## Скрипт для подсчёта постов пользователя и подготовки к отправке в банк.
*Когда-нибудь сделаю нормальное описание. Но это не точно.*

## Инструкция по установке:
1. Создать новую страницу через Администрирование
2. Вставить в неё код из блока ниже.
3. Найти в коде конфигурацию и прописать что душе угодно

```html
<style>
    .bank-checker-container {
        margin: 20px;
        padding: 20px;
        border: 1px solid #ddd;
    }
    
    .bank-checker-input {
        margin: 10px 0;
        padding: 8px;
        width: 300px;
        border: 1px solid #ccc;
    }
    
    .bank-checker-table {
        width: 100%;
        border-collapse: collapse;
        margin: 20px 0;
    }
    
    .bank-checker-table th,
    .bank-checker-table td {
        border: 1px solid #ddd;
        padding: 8px 12px;
        text-align: left;
    }
    
    .bank-checker-table th {
        font-weight: bold;
    }
    
    .bank-checker-table tr.claimed_bcpc {
        background-color: #00ff0010;
    }
    
    .bank-checker-table tr.unclaimed_bcpc {
        background-color: #ff000010;
    }
    
    .bank-checker-table tr.first-post_bcpc {
        background-color: #0000ff10;
    }
    
    .bank-checker-table .row-number_bcpc {
        text-align: center;
        font-weight: bold;
    }
    
    .bank-checker-table .char-count_bcpc {
        text-align: right;
        font-family: monospace;
    }
    
    .bank-checker-table .response-time_bcpc {
        text-align: center;
        font-family: monospace;
        font-size: 12px;
    }
    
    .bank-checker-table .post-type_bcpc {
        text-align: center;
    }
    
    .bank-checker-table .status_bcpc {
        text-align: center;
        font-weight: bold;
    }
    
    .stats_bcpc {
        margin: 20px 0;
        padding: 15px;
        border: 1px solid #ddd;
    }
    
    .stats-table_bcpc {
        width: 100%;
        border-collapse: collapse;
        margin: 15px 0;
    }
    
    .stats-table_bcpc th,
    .stats-table_bcpc td {
        border: 1px solid #ddd;
        padding: 10px;
        text-align: center;
    }
    
    .stats-table_bcpc th {
        font-weight: bold;
    }
    
    .stats-table_bcpc .stat-total_bcpc {
        font-weight: bold;
    }
    
    .stats-table_bcpc .stat-claimed_bcpc {
        background-color: #00ff0010;
    }
    
    .stats-table_bcpc .stat-unclaimed_bcpc {
        background-color: #ff000010;
    }
    
    .stats-table_bcpc tr td:first-child {
        text-align: left;
        font-weight: bold;
    }
    
    .controls_bcpc {
        margin: 10px 0;
        display: flex;
        gap: 5px;
    }
    
    .controls_bcpc button {
    }
    
    .controls_bcpc button.primary_bcpc {
    }
    
    .loading-spinner_bcpc {
        display: inline-block;
        width: 20px;
        height: 20px;
        border: 3px solid #f3f3f3;
        border-top: 3px solid #3498db;
        border-radius: 50%;
        animation: spin_bcpc 1s linear infinite;
        margin-right: 10px;
    }
    
    .last-bank-visit_bcpc {
        margin-top: 15px;
        padding: 10px;
        border: 1px solid #ddd;
        text-align: center;
    }
    
    .last-bank-visit_bcpc a {
        color: #2196F3;
        text-decoration: none;
        font-weight: bold;
    }
    
    .last-bank-visit_bcpc a:hover {
        text-decoration: underline;
    }
    
    #userInfo_bcpc {
        display: block;
    }
    
    .template-controls_bcpc {
        margin: 10px 0;
        display: flex;
        gap: 5px;
    }
    
    @keyframes spin_bcpc {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
</style>

<div class="bank-checker-container">
    <h2 id="userInfo_bcpc">Банк: подсчёт постов</h2>
    
    <div class="user-input_bcpc">
        <label for="userIdInput_bcpc">ID пользователя:</label>
        <input type="text" id="userIdInput_bcpc" class="bank-checker-input" 
               placeholder="Оставьте пустым для текущего пользователя">
        <button onclick="initUserPostAnalysis_bcpc()" class="button">Начать подсчёт</button>
    </div>
    
    <div id="loading_bcpc" style="display: none; margin: 10px 0;">
        <div class="loading-spinner_bcpc"></div>
        <span id="loadingStatus_bcpc">Загрузка данных...</span>
    </div>
    
    <div id="templateControls_bcpc" class="template-controls_bcpc" style="display: none;">
        <button id="templateDateBtn_bcpc" class="button primary_bcpc" onclick="generateTemplateByDate_bcpc()">Шаблон: по дате</button>
        <button id="templateLengthBtn_bcpc" class="button primary_bcpc" onclick="generateTemplateByLength_bcpc()">Шаблон: по длине</button>
        <button id="templateHideBtn_bcpc" class="button" onclick="hideTemplate_bcpc()">Шаблон: скрыть</button>
    </div>
    <div id="bank-template_bcpc"></div>
    
    <div id="controlsTop_bcpc" class="controls_bcpc" style="display: none;">
        <button id="togglePostsBtn_bcpc" class="button" style="display: none;" onclick="togglePostsVisibility_bcpc()">Скрыть учтённые посты</button>
    </div>
    <div id="results_bcpc"></div>
</div>

<script>
/* ----------------------------------------------------------- */
/* КОНФИГУРАЦИЯ */
/* ----------------------------------------------------------- */
const CONFIG_bcpc = {
  GAME_FORUMS: [11, 12, 14, 22, 23], // id ФОРУМОВ с играми
  BANK_TOPICS: [9], // id топиков банка
  COUNT_CHARACTERS: true, // Считать символы в постах
  CHECK_RESPONSE_TIME: true, // Считать, через сколько ответили
  RESPONSE_INTERVAL_HOURS: 24, // Сколько часов ответ считается оперативным
  BANK_TOPIC_NAME: "Банк", // Как будет подписана ссылка на банк
  SUBJECT_MAX_LENGTH: 30, // Максимальная длина отображаемого названия темы (обрезается через ...)
  
  // ЭТО НЕ ТРОГАЕМ!
  POSTS_PER_REQUEST: 100, // Не трогаем
  TOPICS_PER_REQUEST: 100, // Не трогаем
  BASE_URL: window.location.origin // Не трогаем
};

/* ----------------------------------------------------------- */
/* ШАБЛОНЫ И СТРОКОВЫЕ КОНСТАНТЫ */
/* ----------------------------------------------------------- */
const TEMPLATES_bcpc = {
  // Статистика
  STATS: `
    <h3>Статистика активности</h3>
    <table class="stats-table_bcpc">
      <thead>
        <tr>
          <th></th>
          <th>Постов</th>
          <th>Символов</th>
          <th>Открытия темы</th>
          <th>Быстрые ответы</th>
        </tr>
      </thead>
      <tbody>
        <tr class="stat-total_bcpc">
          <td><strong>Всего:</strong></td>
          <td>{{total_posts}}</td>
          <td>{{total_chars}}</td>
          <td>{{total_openings}}</td>
          <td>{{total_responses}}</td>
        </tr>
        <tr class="stat-claimed_bcpc">
          <td><strong>Учтено:</strong></td>
          <td>{{claimed_posts}}</td>
          <td>{{claimed_chars}}</td>
          <td>{{claimed_openings}}</td>
          <td>{{claimed_responses}}</td>
        </tr>
        <tr class="stat-unclaimed_bcpc">
          <td><strong>Не учтено:</strong></td>
          <td>{{unclaimed_posts}}</td>
          <td>{{unclaimed_chars}}</td>
          <td>{{unclaimed_openings}}</td>
          <td>{{unclaimed_responses}}</td>
        </tr>
      </tbody>
    </table>
  `,
  
  // Последнее посещение банка
  LAST_VISIT: `
    <div class="last-bank-visit_bcpc">
      <strong>Последнее посещение банка:</strong> 
      <a href="{{visit_url}}" target="_blank" title="Перейти к последнему посту в банке">{{visit_date}}</a>
    </div>
  `,
  
  // Заголовок таблицы
  TABLE_HEAD: `
  <thead>
	  <tr>
		<th>#</th>
		<th>Дата</th>
		<th>Тема</th>
		<th>Пост</th>
		<th>Символов</th>
		<th>Время ответа</th>
		<th>Тип</th>
		<th>Учёт в банке</th>
	  </tr>
	</thead>
`,
  
  // Строка таблицы
  TABLE_ROW: `
    <tr class="{{row_class}}">
      <td class="row-number_bcpc">{{row_number}}</td>
      <td>{{post_date}}</td>
      <td title="{{post_subject}}">{{post_subject_short}}</td>
      <td><a href="{{post_url}}" target="_blank">{{post_id}}</a></td>
      <td class="char-count_bcpc">{{char_count}}</td>
      <td class="response-time_bcpc">{{response_time}}</td>
      <td class="post-type_bcpc">{{post_type}}</td>
      <td>{{status_icon}} {{bank_reference}}</td>
    </tr>
  `,
  
  // Шаблон для банка
  BANK_TEMPLATE: `
[b]Учёт игровой активности[/b]

{{opening_posts}}
{{game_posts}}

[i]Всего игровых постов: {{total_game_posts}}, {{total_game_chars}} символов[/i]
  `,
  
  // Секция открытий
  OPENING_SECTION: `
[b]Открытия эпизодов:[/b]
{{opening_list}}
  `,
  
  // Секция игровых постов
  GAME_SECTION: `
[b]Игровые посты:[/b]
{{game_list}}
  `,
  
  // Форматы строк для банка
  BANK_FORMATS: {
    OPENING_LINE: "{{number}}. [url={{topic_url}}]{{subject}}[/url]",
    GAME_LINE: "{{number}}. [url={{post_url}}]{{subject}}[/url]: {{char_count}} символов{{response_info}}",
    GAME_LINE_WITH_RESPONSE: " ({{response_text}})",
    RESPONSE_TEXT: "Отвечено через {{response_time}}"
  },
  
  // Заголовок подсчёта постов
  POST_COUNTING_HEADER: `Подсчёт постов пользователя {username} (ID: {uid})`,
  
  // Сообщения интерфейса
  MESSAGES: {
    NO_POSTS: "Игровые посты не найдены",
    ERROR: "Произошла ошибка: {message}",
    INVALID_USER_ID: "Некорректный ID пользователя!",
    USER_NOT_FOUND: "Пользователь не найден!",
    USER_LOAD_ERROR: "Произошла ошибка при загрузке данных пользователя",
    NO_UNCLAIMED_POSTS: "Нет неучтенных постов для генерации шаблона",
    COPIED: "Скопировано в буфер обмена!",
    
    // Статусы загрузки
    LOADING_USER: "Загрузка данных пользователя...",
    LOADING_TOPICS: "Загрузка топиков игровых форумов...",
    LOADING_BANK: "Загрузка постов банка...",
    SEARCHING_MENTIONS: "Поиск упоминаний в банке...",
    PROCESSING_TOPIC: "Обработка топика {current}/{total}...",
    LOADED_TOPICS: "Загружено {count} топиков...",
    LOADED_BANK: "Загружено {count} постов банка..."
  },
  
  // Тексты кнопок
  BUTTONS: {
    HIDE_CLAIMED: "Скрыть учтенные посты",
    SHOW_ALL: "Показать все посты",
    TEMPLATE_DATE: "Шаблон: по дате",
    TEMPLATE_LENGTH: "Шаблон: по длине",
    TEMPLATE_HIDE: "Шаблон: скрыть",
    COPY: "Копировать",
    START_COUNT: "Начать подсчёт"
  },
  
  // Типы постов
  POST_TYPES: {
    OPENING: "Открытие",
    RESPONSE: "Ответ"
  },
  
  // Заголовки шаблонов
  TEMPLATE_HEADERS: {
    BANK_TEMPLATE: "Шаблон для вставки в банк (сортировка {sortType}):"
  }
};
</script>
<script src="https://4edo.github.io/mybb/bank_checker_posts_counter/script.js"></script>
```
