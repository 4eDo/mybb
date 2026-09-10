# Подставление содержимого поста в другой пост.

В html-низ СТРОГО:
```html
<!-- Тег [postById] в форме ответа -->
<script type="text/javascript" src="https://4edo.github.io/mybb/loadPostById/loadPostById.js"></script>
```

В пользовательские BB-теги:
```
postById[/data-value]:eas
```

В форму ответа (добавление кнопки в список кнопок):
```
<script type="text/javascript">
FORUM.set('editor.addition.tags.postById', {
    name: 'Содержимое поста по ID',
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
