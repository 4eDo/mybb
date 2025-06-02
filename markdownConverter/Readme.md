# Совершилось чудо :)
# MD-разметку теперь можно использовать и на Mybb!

## Установка
В **Администрирование - Формы - Пользовательские bb теги** добавить:
```
markdown
```

Размещать в html-низ:
```html
<!-- тег MARKDOWN от 4eDo -->
<style>
	/* Иконка в редактор */
	#button-markdown {
		background-image: url(https://forumupload.ru/uploads/001c/02/df/2/764675.png);
	}
	
	/* Иконка в правом верхнем углу блока MD-кода*/
	.custom_tag_markdown {
		background-color: rgba(128, 128, 128, 0.1);
		border: 1px solid rgba(128, 128, 128, 0.5);
		border-radius: 2px;
		position: relative;
		padding: 10px;
	}
	.custom_tag_markdown::after {
		content: "M\1F80B";
		position: absolute;
		top: 1px;
		right: 3px;
		border: 2px solid;
		border-radius: 2px;
		font-weight: bold;
		font-family: Tahoma;
		padding: 1px 2px;
		font-size: 11px;
	}
	
	/* Отображение списков */
	.custom_tag_markdown ul li {
		list-style: initial !important;
	}
	.custom_tag_markdown ol li {
		list-style: decimal !important;
	}
	
	/* Отображение языка написания кода */
	.custom_tag_markdown .codelang {
		float: right;
	}
	/* Отображение кнопки копирования кода*/
	.custom_tag_markdown .legend {
		cursor: pointer;
	}

	/* Кнопки копирования ссылки на заголовок */
	.markdown-links {
		display: inline-block;
		margin-left: 4px;
	}
	.markdown-url {
		background-image: url('https://forumupload.ru/uploads/001c/02/df/2/564049.png');
	}
	.markdown-bb {
		background-image: url('https://forumupload.ru/uploads/001c/02/df/2/442871.png');
	}
	.markdown-url, .markdown-bb {
		display: inline-block;
		cursor: pointer;
		background-size: contain;
		background-repeat: no-repeat;
		background-position: center;
		opacity: 0;
		transition: opacity 0.2s;
		width: 16px;
		height: 16px;
	}
	.markdown-heading:hover .markdown-url, .markdown-heading:hover .markdown-bb {
		opacity: 1;
	}
</style>
<!-- тег MARKDOWN от 4eDo -->
<script type="text/javascript" src="https://4edo.github.io/mybb/markdownConverter/markdownConverter.js"></script>
```

## Что поддерживает?
1. Стандартные символы форматирования:
   - Жирный шрифт (используя **такой** или __такой__ синтаксис)
   - Курсив (используя *такой* или _такой_ синтаксис)
   - Зачёркивание (при помощи ~~такого~~)
   - Подчёркивание ( Этого функционала +нет+ в стандартном md, но на форумах - традиция)
2. Списки
   - Нумерованные (начинаются с 1. )
   - Ненумерованные (начиная с - + или *)
   - Многоуровневые (пробел перед маркером)
3. Чекбоксы ( [ ] и [x])
4. Заголовки (начинаются с # , уровни 3 и выше оформляются в одинаковый хтмл)
5. Картинки (через ![такое оформление](https://github.com/4eDo/mybb/tree/main/markdownConverter#readme) )
6. Ссылки (через [такое оформление](https://github.com/4eDo/mybb/tree/main/markdownConverter#readme) )
7. Цитаты (начинаются с > , вложенные - >> и т.д.)
8. Код
   - Однострочный
   - Многострочный
9. Таблицы
10. Разделители

## А ещё
Он позволяет быстро получать ссылку на заголовки. Как просто URL, так и уже оформленные в BB-код.

## Изменить оформление заголовков, цитат и прочих элементов
Изменить оформление заголовков, цитат можно в коде. Для этого необходимо забрать код из файла https://github.com/4eDo/mybb/blob/main/markdownConverter/markdownConverter.js , найти в нём нужные места и поправить. По умолчанию:
```
[quote][align=center][b]Заголовок 1[/b][/align][/quote]
[quote][b]Заголовок 2[/b][/quote]
[b]Заголовок 3 и выше[/b]
```
Править надо осмотрительно. Небрежность приведёт к поломке html-кода страниц, нерабосим копированиям ссылки на заголовок и т.п.
