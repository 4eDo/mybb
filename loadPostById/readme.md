# Подставление содержимого поста в другой пост.

В html-верх СТРОГО:
```html
<!-- Тег [postById] в форме ответа. by 4eDo https://github.com/4eDo/mybb/tree/main/loadPostById# -->
<script type="text/javascript" src="https://4edo.github.io/mybb/loadPostById/loadPostById.js"></script>
```

В пользовательские BB-теги:
```
postById[/data-value]:eas
```

В форму ответа (добавление кнопки в список кнопок) БЕЗ спойлера:
```
<script type="text/javascript">
    FORUM.set('editor.addition.tags.postById', {
        name: 'Встроить пост по ID',
        class_name: function() {
            return prompt("Введите ID поста", "");
        },
        onclick: function() {
            var id = FORUM.get('editor.addition.tags.postById.class_name()');
            if (id) {
                id = String(id).replace(/[^\d]/g, '');
                if (id) bbcode('[postById=' + id + ']', '');
            }
        }
    });
</script>
```

В форму ответа (добавление кнопки в список кнопок) СО СПОЙЛЕРОМ:
```
<script type="text/javascript">
    FORUM.set('editor.addition.tags.postById', {
        name: 'Пост по ID в спойлере',
        class_name: function() {
            return prompt("Введите ID поста", "");
        },
        onclick: function() {
            var id = FORUM.get('editor.addition.tags.postById.class_name()');
            if (!id) return;
            id = String(id).replace(/[^\d]/g, '');
            if (!id) return;
    
            var title = prompt("Заголовок спойлера", "");
            if (title === null) return;
            title = title.replace(/"/g, '&quot;');
    
            bbcode('[spoiler="' + title + '"][postById=' + id + '][/spoiler]', '');
        }
    });
</script>
```
