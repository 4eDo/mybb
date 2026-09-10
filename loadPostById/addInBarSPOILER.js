/** Встраивание сообщения в пост по pid
	КНОПКА В РЕДАКТОР: со спойлером
	Основной скрипт: loadPostById v1.1 2026-09-10
	Автор: 4eDo
	Docs: https://github.com/4eDo/mybb/tree/main/loadPostById#
*/
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
