# Модерирование тем: опция "Закрыть и перенести"

## Установка (3 способа)
### 1. Залитый на форум
```html
<!-- Модерирование тем: опция "Закрыть и перенести" от 4eDo -->
<script type="text/javascript" src="https://forumstatic.ru/files/001c/52/b6/34055.js"></script>
```

### 2. Сырой код
```html
<!-- Модерирование тем: опция "Закрыть и перенести" от 4eDo -->
<script>$(document).ready(function() {
  if(GroupID < 3) {
    if (sessionStorage.getItem('returnPage')) {
      sessionStorage.removeItem('returnPage');
      window.location.href = $('#mod-options option:contains("Перенести тему")').val();
    }
    $('<option value="closeAndMove">Закрыть и перенести</option>')
      .insertAfter($('#mod-options option:contains("Модерирование темы")'));
    $('#mod-options').on('change', function() {
      let selectedValue = $(this).val();
      if (selectedValue === "closeAndMove") {
        sessionStorage.setItem('returnPage', window.location.href);
        window.location.href =  $('#mod-options option:contains("Закрыть тему")').val();
      } else if (selectedValue) {
        window.location.href = selectedValue;
      }
    });
  }
});</script>
```

### 3. Ссылка на GitHub
```html
<!-- Модерирование тем: опция "Закрыть и перенести" от 4eDo -->
<script type="text/javascript" src="https://4edo.github.io/mybb/modOption/modOption.js"></script>
```

