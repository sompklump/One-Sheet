$(function () {
    $('#first').keepRatio({ ratio: 16 / 9, calculate: 'height' });
    $('#second').keepRatio({ ratio: 4 / 3, calculate: 'width' });

    var printBoxSize = function ($el) {
        var w = $el.width();
        var h = $el.height();
        $el.html(w + ' x ' + h + ' = ' + (w / h).toString().substr(0, 4));
    };

    var $div = $('div[id]');
    var resizeEventHandler = function () {
        $div.each(function () { printBoxSize($(this)); });
    };

    $(window).on('resize', resizeEventHandler);
    resizeEventHandler();
});
