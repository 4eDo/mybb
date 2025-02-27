$(document).ready(function() {
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
});
