document.addEventListener('DOMContentLoaded', function() {
    const addFieldButton = $('#add-field-button');
    const fieldList = $('#field-list');
    const parentsList = $('#parentsList');
    const tmplExistTable = $('#tmpl-exist');
    const generateJsonButton = $('#generate-json-button');
    const jsonTextarea = $('#template-text');

    const generateTemplateButton = $('#generate-template-button');
    const templateTextarea = $('#template-text');

    const saveTemplateButton = $('#save-template-button');
	
	const navList = $('#nav-fields');

    let fieldCounter = 0;

    // Функция для сбора данных о полях и формирования JSON
    function generateFieldsJson() {
        const fieldsData = [];

        fieldList.children('li').each(function() {
            const listItem = $(this);
            const fieldData = {};

            // Собираем основные данные
            fieldData.name = listItem.find('#field-name').val();
            fieldData.info = listItem.find('#field-info').val();
            fieldData.type = listItem.find('#field-type').val();
            fieldData.tmpl = listItem.find('#field-tmpl').val();

            // Собираем необязательные данные
            const textTransform = listItem.find('#field-text-transform').val();
            if (textTransform) {
                fieldData.textTransform = textTransform;
            }

            const defaultValue = listItem.find('#field-default').val();
            if (defaultValue) {
                fieldData.default = defaultValue;
            }

            const parentTmpl = listItem.find('#field-parentTmpl').val();
            if (parentTmpl) {
                fieldData.parentTmpl = parentTmpl;
            }

            const targetVal = listItem.find('#field-parent-value').val();
            if (targetVal) {
                fieldData.targetVal = targetVal;
            }

            const wrapperBefore = listItem.find('#field-wrapper-before').val().replaceAll("\\r\\n", "\r\n");
             if (wrapperBefore) {
                 fieldData.wrapperBefore = wrapperBefore;
             }

             const wrapperAfter = listItem.find('#field-wrapper-after').val().replaceAll("\\r\\n", "\r\n");
             if (wrapperAfter) {
                 fieldData.wrapperAfter = wrapperAfter;
             }

            // Устанавливаем valIfEmpty в "none", если поле зависит от родителя
            if (listItem.find('#field-has-parent').prop('checked')) {
                fieldData.valIfEmpty = "none";
            } else {
                const valIfEmpty = listItem.find('#field-val-if-empty').val();
                if (valIfEmpty) {
                    fieldData.valIfEmpty = valIfEmpty;
                }
            }

            // Собираем данные для типа "select"
            if (fieldData.type === 'select') {
                const optList = listItem.find('#field-options-list').val();
                if (optList) {
                    fieldData.optList = optList.split(',').map(item => item.trim()); // Разделяем строку на массив
                }

                // Добавляем опцию "Без значения", если чекбокс установлен или если поле зависит от родителя
                const addEmptyCheckbox = listItem.find('#field-add-empty');
                if (addEmptyCheckbox.prop('checked')) {
                    const emptyOptionValue = listItem.find('#field-empty-option-value').val() || "Без значения";
                    fieldData.addEmptyOpt = emptyOptionValue;
                }

                const optValAndNameList = [];
                listItem.find('#val-name-list li').each(function() {
                    const val = $(this).find('.val').val();
                    const name = $(this).find('.name').val();
                    if (val && name) {
                        optValAndNameList.push({ val: val, name: name });
                    }
                });
                if (optValAndNameList.length > 0) {
                    fieldData.optValAndNameList = optValAndNameList;
                }
            }

            fieldsData.push(fieldData);
        });

        return JSON.stringify(fieldsData, null, 2); // Преобразуем в JSON с отступами
    }

    // Функция для обновления таблицы tmpl-exist
    function updateTmplExistTable() {
        tmplExistTable.empty(); // Очищаем таблицу
		navList.empty();

        // Добавляем заголовок таблицы
        const headerRow = $('<tr>');
        headerRow.append($('<th>', { text: 'Идентификатор' }));
        headerRow.append($('<th>', { text: 'Название' }));
        tmplExistTable.append(headerRow);

        // Перебираем все поля
        fieldList.children('li').each(function() {
            const listItem = $(this);
            const fieldTmpl = "<code>{{" + (listItem.find('#field-tmpl').val() || "??") + "}}</code>";
            const fieldName = listItem.find('#field-name').val() || "поле без названия";
            const fieldInfo = !!listItem.find('#field-parentTmpl').val() ? `Данное поле зависит от другого поля и показывается только когда поле <b>${listItem.find('#field-parentTmpl').val()}</b> принимает значение <b>${listItem.find('#field-parent-value').val()}</b>` : "";
			
			const navItem = $('<li>');
			navItem.append($('<a>', {href: `#${listItem.attr('id')}`, text: `${listItem.find('#field-tmpl').val() || "??"} ${fieldName}`}));
			navList.append(navItem);
			
			const descr = $('<td>');
			descr.append($('<p>', {text: fieldName}));
			if(fieldInfo) descr.append($('<p>', {html: fieldInfo}));

			const row = $('<tr>');
			row.append($('<td>', { html: fieldTmpl }));
			row.append(descr);
			tmplExistTable.append(row);
          
        });
    }

    // Функция для обновления datalist
    function updateParentsList() {
        parentsList.empty(); // Очищаем datalist

        // Перебираем все поля
        fieldList.children('li').each(function() {
            const listItem = $(this);
            const fieldType = listItem.find('#field-type').val();
            const fieldTmpl = listItem.find('#field-tmpl').val();

            if (fieldType === 'select' && fieldTmpl) {
                // Добавляем option в datalist
                parentsList.append($('<option>', { value: fieldTmpl }));
            }
        });
    }

    addFieldButton.on('click', function() {
        fieldCounter++;
        const fieldId = `field-${fieldCounter}`;

        // Создаем элементы списка
        const listItem = $('<li>', { id: `field-item-${fieldId}` });

        // Клонируем форму
        const clonedForm = $('#field-form').clone(true);
        clonedForm.attr('id', `field-form-${fieldId}`);
        clonedForm.css('display', 'block');

        // Функция для отображения/скрытия полей (зависимые и "без значения")
        function toggleAdditionalFields() {
            const hasParentCheckbox = $(this); // Используем this для получения текущего чекбокса
            const addEmptyCheckbox = hasParentCheckbox.closest('li').find('#field-add-empty');
            const parentContainer = hasParentCheckbox.closest('li').find('#field-parentTmpl').closest('.form-group');
            const parentValueContainer = hasParentCheckbox.closest('li').find('#field-parent-value').closest('.form-group');
            const emptyOptionContainer = hasParentCheckbox.closest('li').find('.field-empty-option-container');
            const fieldTypeSelect = hasParentCheckbox.closest('li').find('#field-type');
            const valIfEmptyContainer = hasParentCheckbox.closest('li').find('#field-val-if-empty').closest('.form-group');

            const isSelectType = fieldTypeSelect.val() === 'select';
            const hasParent = hasParentCheckbox.prop('checked');

            // Показываем/скрываем поля, зависящие от родителя
            if (hasParent) {
                parentContainer.show();
                parentValueContainer.show();
                valIfEmptyContainer.hide();
                // Устанавливаем valIfEmpty в "none"
                hasParentCheckbox.closest('li').find('#field-val-if-empty').val('none').prop('disabled', true);

                // Если тип - select, автоматически включаем и делаем read-only "Добавить пустую опцию"
                if (isSelectType) {
                    console.log("Enabling and disabling addEmptyCheckbox");
                    addEmptyCheckbox.prop('checked', true).prop('disabled', true);
                }
            } else {
                parentContainer.hide();
                parentValueContainer.hide();
                valIfEmptyContainer.show();
                // Разблокируем и очищаем valIfEmpty
                hasParentCheckbox.closest('li').find('#field-val-if-empty').prop('disabled', false);
                // Если поле пустое, оставим его пустым, иначе ничего не меняем.
                if (!hasParentCheckbox.closest('li').find('#field-val-if-empty').val()) {
                    hasParentCheckbox.closest('li').find('#field-val-if-empty').val('');
                }

                // Убираем "обязательность" с "Добавить пустую опцию"
                addEmptyCheckbox.prop('disabled', false);
            }

            // Показываем/скрываем поле "Значение опции 'Без значения'", если установлен чекбокс "Добавить пустую опцию"
            if (addEmptyCheckbox.prop('checked')) {
                emptyOptionContainer.show();
            } else {
                emptyOptionContainer.hide();
            }
        }

        // Функция для отображения/скрытия полей в зависимости от типа поля
        function toggleTypeFields() {
            const fieldType = clonedForm.find('#field-type').val();
            const optionsListContainer = clonedForm.find('#field-options-list').closest('.form-group');
            const addEmptyContainer = clonedForm.find('#field-add-empty').closest('.form-group');
            const valNameListContainer = clonedForm.find('#val-name-list').closest('.form-group');

            if (fieldType === 'select') {
                optionsListContainer.show();
                addEmptyContainer.show();
                valNameListContainer.show();
            } else {
                optionsListContainer.hide();
                addEmptyContainer.hide();
                valNameListContainer.hide();
            }

            updateParentsList();
        }

        // Функция для добавления пары "значение - название"
        function addValNamePair() {
            const valNameList = clonedForm.find('#val-name-list');
            const newPair = $('<li>');
            newPair.append(
                $('<label>', { text: 'Значение:' }),
                $('<input>', { type: 'text', class: 'val', name: 'val' }),
                $('<label>', { text: 'Название:' }),
                $('<input>', { type: 'text', class: 'name', name: 'name' }),
                $('<button>', { type: 'button', class: 'remove-val-name-button', text: 'Удалить пару' })
                    .on('click', function() {
                        newPair.remove();
                    })
            );
            valNameList.append(newPair);
        }

        // Инициализация при загрузке (с setTimeout)
        setTimeout(function() {
            const initialCheckbox = clonedForm.find('#field-has-parent')[0];

            if (initialCheckbox) {
                toggleAdditionalFields.call(initialCheckbox); // Вызываем toggleAdditionalFields для инициализации
            } else {
                console.log("#field-has-parent not found in clonedForm");
            }

            toggleTypeFields();
            updateParentsList();
            updateTmplExistTable(); // Обновляем таблицу при создании поля
        }, 0);

        // Добавляем обработчик при изменении флажка "Это поле зависит от другого?"
        const hasParentCheckbox = clonedForm.find('#field-has-parent');
        hasParentCheckbox.on('change', toggleAdditionalFields);

        // Добавляем обработчик при изменении чекбокса "Добавить пустую опцию"
        const addEmptyCheckbox = clonedForm.find('#field-add-empty'); // Получаем ссылку на чекбокс "Добавить пустую опцию"

         // Добавляем обработчик при изменении идентификатора или названия поля
         clonedForm.find('#field-tmpl, #field-name').on('change', function() {
            updateTmplExistTable();
        });

        // Добавляем обработчик при изменении типа поля
        const fieldTypeSelect = clonedForm.find('#field-type');
        fieldTypeSelect.on('change', toggleTypeFields);

        // Добавляем обработчик для кнопки "Добавить пару 'значение - название'"
        const addValNamePairButton = clonedForm.find('#add-val-name-pair-button');
        addValNamePairButton.on('click', addValNamePair);

        listItem.append(clonedForm);
        fieldList.append(listItem);

        // Кнопка "Удалить поле"
        const removeButton = $('<button>', { text: 'Удалить поле' });
        removeButton.on('click', function() {
            listItem.remove();
            updateParentsList();
            updateTmplExistTable(); // Обновляем таблицу при удалении поля
        });
        listItem.append(removeButton);

         // Обновляем таблицу при изменении идентификатора или названия поля
         clonedForm.find('#field-tmpl, #field-name').on('input', function() {
            updateTmplExistTable();
        });
    });

    // Обработчик для кнопки "Сформировать JSON"
    generateJsonButton.on('click', function() {
        const jsonData = generateFieldsJson();
        jsonTextarea.val(jsonData);
    });

    // Функция для генерации кода шаблона
    function generateTemplateCode() {
        const templateName = $('#template-name').val();
        const forumIds = $('#forum-ids').val();
        const topicIds = $('#topic-ids').val();
        const fieldsJson = generateFieldsJson();
        const templateCodeValue = $('#template-code').val(); // Получаем значение из textarea

        let templateCode = `<!-- ШАБЛОН ${templateName} -->\n`;
        templateCode += `\t<div class="template">\n`;
        templateCode += `\t<div class="tmpl_name">${templateName}</div>\n`;
        templateCode += `\t<div class="tmpl_forum_ids">${forumIds}</div>\n`;
        templateCode += `\t<div class="tmpl_topic_ids">${topicIds}</div>\n`;
        templateCode += `\t<div class="tmpl_form">\n${fieldsJson}\n\t</div>\n`;
        templateCode += `\t<div class="tmpl_code">\n${templateCodeValue}\n\t</div>\n`; // Используем значение из textarea
        templateCode += `</div>\n<!-- конец ШАБЛОН ${templateName} -->`;

        return templateCode;
    }

    // Обработчик для кнопки "Сформировать шаблон"
    generateTemplateButton.on('click', function() {
        const templateCode = generateTemplateCode();
        templateTextarea.val(templateCode);
    });

    // Обработчик для кнопки "Сохранить шаблон"
    saveTemplateButton.on('click', function() {
        const templateCode = generateTemplateCode();
        const templateName = $('#template-name').val() || "template"; // Используем имя шаблона или "template" по умолчанию
        const fileName = `${templateName}.txt`; // Формируем имя файла

        // Создаем Blob с кодом шаблона
        const blob = new Blob([templateCode], { type: "text/plain;charset=utf-8" });

        // Создаем ссылку для скачивания
        const url = URL.createObjectURL(blob);

        // Создаем элемент <a>
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName; // Устанавливаем имя файла для скачивания
        document.body.appendChild(a); // Добавляем ссылку в DOM

        // Инициируем скачивание
        a.click();

        // Удаляем ссылку из DOM
        document.body.removeChild(a);

        // Освобождаем URL
        URL.revokeObjectURL(url);
    });

    // Обработчик для кликов по CODE
    document.addEventListener('click', function(event) {
        if (event.target.tagName === 'CODE') {
            const codeElement = event.target;
            const codeText = codeElement.textContent || codeElement.innerText; // Для совместимости

            // Копируем текст в буфер обмена
            navigator.clipboard.writeText(codeText)
                .then(() => {
                    // Успешно скопировано
                    console.log('Код скопирован в буфер обмена:', codeText);
                    // Добавляем класс copied
                    codeElement.classList.add('copied');
                    // Удаляем класс copied через некоторое время
                    setTimeout(() => {
                        codeElement.classList.remove('copied');
                    }, 1500);
                })
                .catch(err => {
                    // Ошибка при копировании
                    console.error('Не удалось скопировать код в буфер обмена:', err);
                    // Можно предоставить пользователю альтернативный способ копирования (например, выделить текст и предложить пользователю альтернативный способ копирования)
                });
        }
    });
	
	   // Добавляем обработчик для загрузки файла
    const loadTemplateFile = $('#load-template-file');
    loadTemplateFile.on('change', function(event) {
        const file = event.target.files[0];

        if (file) {
            const reader = new FileReader();

            reader.onload = function(e) {
                try {
                    const fileContent = e.target.result;
                    const templateData = parseTemplateData(fileContent);
                    populateForm(templateData);
                    console.log("Файл загружен и форма заполнена");
                } catch (error) {
                    console.error("Ошибка при обработке файла:", error);
                }
            };

            reader.onerror = function() {
                console.error("Ошибка при чтении файла");
            };

            reader.readAsText(file);
        }
    });
	
	 function parseTemplateData(fileContent) {
        // Извлекаем данные, используя регулярные выражения
        const templateNameMatch = fileContent.match(/<div class="tmpl_name">(.*?)<\/div>/);
        const forumIdsMatch = fileContent.match(/<div class="tmpl_forum_ids">(.*?)<\/div>/);
        const topicIdsMatch = fileContent.match(/<div class="tmpl_topic_ids">(.*?)<\/div>/);
        const fieldsJsonMatch = fileContent.match(/<div class="tmpl_form">([\s\S]*?)<\/div>/);
        const templateCodeMatch = fileContent.match(/<div class="tmpl_code">([\s\S]*?)<\/div>/);

        // Сохраняем извлеченные данные в объект
        const templateData = {
            templateName: templateNameMatch ? templateNameMatch[1] : "",
            forumIds: forumIdsMatch ? forumIdsMatch[1] : "",
            topicIds: topicIdsMatch ? topicIdsMatch[1] : "",
            fieldsJson: fieldsJsonMatch ? fieldsJsonMatch[1] : "",
            templateCode: templateCodeMatch ? templateCodeMatch[1] : ""
        };

        return templateData;
    }
	
	// Функция для заполнения формы данными шаблона
function populateForm(templateData) {
    // Заполняем поля формы
    $('#template-name').val(templateData.templateName);
    $('#forum-ids').val(templateData.forumIds);
    $('#topic-ids').val(templateData.topicIds);
    $('#template-code').val(templateData.templateCode.trim());
    $('#json-text').val(templateData.fieldsJson); // Устанавливаем JSON

    // Очищаем существующие поля (элементы <li>)
    fieldList.empty();

    // Разбираем JSON fields
    try {
        const fields = JSON.parse(templateData.fieldsJson);

        // Создаем элементы <li> для каждого поля
        fields.forEach(function(field) {
            addFieldButton.click(); // Создаем новое поле
            const lastItem = fieldList.children().last(); // Находим последний созданный <li>

            // Заполняем поля
            lastItem.find('#field-name').val(field.name);
            lastItem.find('#field-info').val(field.info);
            lastItem.find('#field-type').val(field.type);
            lastItem.find('#field-tmpl').val(field.tmpl);
            lastItem.find('#field-text-transform').val(field.textTransform || "");
            lastItem.find('#field-default').val(field.default || "");
            lastItem.find('#field-parentTmpl').val(field.parentTmpl || "");
            lastItem.find('#field-parent-value').val(field.targetVal || "");
            lastItem.find('#field-wrapper-before').val(field.wrapperBefore || "");
            lastItem.find('#field-wrapper-after').val(field.wrapperAfter || "");
            lastItem.find('#field-val-if-empty').val(field.valIfEmpty || "");

            // Чекбокс "Зависит от родителя"
            const hasParentCheckbox = lastItem.find('#field-has-parent');
            hasParentCheckbox.prop('checked', !!field.parentTmpl);
            hasParentCheckbox.trigger('change'); // Запускаем обработчик события change

            // Если тип - select
            if (field.type === 'select') {
                lastItem.find('#field-options-list').val(field.optList ? field.optList.join(', ') : "");
                const addEmptyCheckbox = lastItem.find('#field-add-empty');
                addEmptyCheckbox.prop('checked', !!field.addEmptyOpt);
                addEmptyCheckbox.trigger('change'); // Запускаем обработчик change
                lastItem.find('#field-empty-option-value').val(field.addEmptyOpt);

                // Добавление пар "значение-название"
                if (field.optValAndNameList) {
                    const valNameList = lastItem.find('#val-name-list');
                    field.optValAndNameList.forEach(pair => {
                        const newPair = $('<li>');
                        newPair.append(
                            $('<label>', { text: 'Значение:' }),
                            $('<input>', { type: 'text', class: 'val', name: 'val', value: pair.val }),
                            $('<label>', { text: 'Название:' }),
                            $('<input>', { type: 'text', class: 'name', name: 'name', value: pair.name }),
                            $('<button>', { type: 'button', class: 'remove-val-name-button', text: 'Удалить пару' })
                                .on('click', function() {
                                    newPair.remove();
                                })
                        );
                        valNameList.append(newPair);
                    });
                }
            }
            //  Обновляем таблицу tmpl-exist
            updateTmplExistTable();
        });
    } catch (error) {
        console.error("Ошибка при разборе JSON:", error);
        console.log("JSON для разбора:", templateData.fieldsJson);
    }
}
});