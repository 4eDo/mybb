/** Встраивание сообщения в пост по pid
	КНОПКА В РЕДАКТОР: без спойлера
	Основной скрипт: loadPostById v1.1 2026-09-10
	Автор: 4eDo
	Docs: https://github.com/4eDo/mybb/tree/main/loadPostById#
*/
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
