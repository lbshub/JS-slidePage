/**
 * LBS slidePage 绝对定位方式 支持WP
 * Date: 2014-11-20
 * ===================================================
 * opts.el 外围包裹容器/滑动事件对象(一个字符串的CSS选择器或者元素对象)
 * opts.index 索引(默认0) 指定显示哪个索引的页
 * opts.current	当前页添加的类名(默认'current')
 * opts.navShow 是否需要导航指示 默认false不需要 
 * opts.navClass 导航指示容器的类名 方便设置样式 (默认'slide-nav') 
 * opts.auto 是否自动播放 默认false
 * opts.delay 自动播放间隔时间 默认5000(单位毫秒) 自动播放时有效
 * opts.locked 是否锁定头尾滑动  默认false 如果开启则不能使用自动播放
 * opts.effect 动画效果(平移=translate 缩放=scale 重叠=overlap) 默认平移
 * opts.duration 动画持续时间 默认300(单位毫秒) 
 * opts.minScale 动画效果为缩放时的最小缩放比率(0 ~ 1) 1为没有缩放效果 默认0.5
 * opts.start 手指按下时 执行函数
 * opts.move 手指移动中 执行函数
 * opts.end 手指收起后 执行函数
 * ===================================================
 * this.box 包裹页的容器对象
 * this.index 当前索引
 * this.length 有多少页 最后一页的索引为 this.length-1
 * this.play 调用自动播放的方法 
 * this.stop 清除自动播放的方法
 * this.up 手动调用向上滑动翻页的方法 方便增加点击按钮时调用
 * this.down 手动调用向下滑动翻页的方法
 * ===================================================
 **/
;(function() {
	'use strict';
	window.slidePage = function(opts) {
		opts = opts || {};
		if (opts.el === undefined) return;
		this.box = typeof opts.el === 'string' ? document.querySelector(opts.el) : opts.el;
		this.pages = this.box.children;
		this.length = this.pages.length;
		if (this.length < 1) return;
		if (opts.index > this.length - 1) opts.index = 0;

		this.body = document.getElementsByTagName('body')[0];
		this.nav = null;
		this.navs = [];
		this.navShow = !!opts.navShow || false;
		this.navClass = opts.navClass || 'slide-nav';

		this.index = this.oIndex = opts.index || 0;
		this.current = opts.current || 'current';
		this.locked = !!opts.locked || false;
		this.auto = !!opts.auto || false;
		this.auto && (this.delay = opts.delay || 5000);
		this.effect = opts.effect || 'translate';
		this.duration = opts.duration || 300;
		this.minScale = opts.minScale || 0.5;

		this.start = opts.start || function() {};
		this.move = opts.move || function() {};
		this.end = opts.end || function() {};

		this.timer = null;
		this.animated = true;
		this.touch = {};
		this.point = '';
		this.cache = {};

		this.init();
	};
	slidePage.prototype = {
		init: function() {
			this.navShow && this.createNav();
			this.initSet();
			this.bind();
		},
		createNav: function() {
			var li = null,
				i = 0;
			this.nav = document.createElement('ul');
			for (; i < this.length; i++) {
				li = document.createElement('li');
				this.navs.push(li);
				this.nav.appendChild(li);
			}
			this.nav.className = this.navClass;
			this.body.appendChild(this.nav);
		},
		initSet: function() {
			this.height = document.documentElement.clientHeight || document.body.clientHeight;
			if (this.css(this.box, 'position') !== 'absolute' || this.css(this.box, 'position') !== 'relative') this.box.style.position = 'relative';
			if (this.css(this.box, 'overflow') !== 'hidden') this.box.style.overflow = 'hidden';
			this.box.style.height = this.height + 'px';
			for (var i = 0; i < this.length; i++) {
				if (this.css(this.pages[i], 'display') !== 'none') this.pages[i].style.display = 'none';
				if (this.css(this.pages[i], 'position') !== 'absolute') this.pages[i].style.position = 'absolute';
				this.pages[i].style.height = this.height + 'px';
			}
			if (this.navShow) {
				this.nav.style.marginTop = -this.nav.offsetHeight / 2 + 'px';
				this.navs[this.index].className = this.current;
			}
			this.pages[this.index].className += ' ' + this.current;
			this.zIndex = parseInt(this.css(this.pages[this.index], 'zIndex') === 'auto' ? 1 : this.css(this.pages[this.index], zIndex)) + 10;
			this.pages[this.index].style.display = 'block';
		},
		bind: function() {
			var _this = this;
			this.on(this.box, ['touchstart', 'pointerdown', 'MSPointerDown', 'mousedown'], function(e) {
				_this.touchStart(e);
				_this.auto && _this.stop();
			});
			this.on(this.box, ['touchmove', 'pointermove', 'MSPointerMove', 'mousemove'], function(e) {
				_this.touchMove(e);
				_this.auto && _this.stop();
			});
			this.on(this.box, ['touchend', 'touchcancel', 'pointerup', 'pointercancel', 'MSPointerUp', 'MSPointerCancel', 'mouseup'], function(e) {
				_this.touchEnd(e);
				_this.auto && _this.play();
			});
			this.auto && this.play();
		},
		touchStart: function(e) {
			this.point = e.type.toLowerCase().indexOf('down') < 0 ? 'touch' : 'pointer';
			if (this.point === 'pointer') {
				this.touch.x = e.pageX;
				this.touch.y = e.pageY;
			} else if (this.point === 'touch') {
				this.touch.x = e.touches[0].pageX;
				this.touch.y = e.touches[0].pageY;
			}
			this.touch.disX = 0;
			this.touch.disY = 0;
			this.touch.fixed = '';
			this.start && this.start();
		},
		touchMove: function(e) {
			e.stopPropagation();
			e.preventDefault();
			if (this.point === '') return;
			if (this.touch.fixed === 'left') return;
			if (!this.animated) return;
			if (this.point === 'pointer') {
				this.touch.disX = e.pageX - this.touch.x;
				this.touch.disY = e.pageY - this.touch.y;
			} else if (this.point === 'touch') {
				if (e.touches.length > 1) return;
				this.touch.disX = e.touches[0].pageX - this.touch.x;
				this.touch.disY = e.touches[0].pageY - this.touch.y;
			}
			if (this.touch.fixed === '') {
				if (Math.abs(this.touch.disY) > Math.abs(this.touch.disX)) {
					this.touch.fixed = 'up';
				} else {
					this.touch.fixed = 'left';
				}
			}
			if (this.touch.fixed === 'up') {
				if (this.effect === 'scale') {
					this.scale = ((this.height - Math.abs(this.touch.disY)) / this.height).toFixed(3);
					this.scale < this.minScale && (this.scale = this.minScale);
				}
				if (this.touch.disY > 0) {
					if (this.locked && this.oIndex === 0) return;
					this.dis = -this.height;
					this.index = this.oIndex - 1;
					this.index < 0 && (this.index = this.length - 1);
					if (this.effect === 'scale') this.setOrigin(this.oIndex, 'center bottom');
				} else {
					if (this.locked && this.oIndex === this.length - 1) return;
					this.dis = this.height;
					this.index = this.oIndex + 1;
					this.index > this.length - 1 && (this.index = 0);
					if (this.effect === 'scale') this.setOrigin(this.oIndex, 'center top');
				}

				if (this.nIndex !== undefined && this.nIndex !== this.index && this.nIndex !== this.oIndex) {
					this.pages[this.nIndex].style.display = 'none';
					this.pages[this.nIndex].style.zIndex = '';
					this.pages[this.nIndex].style.webkitTransform = this.pages[this.nIndex].style.transform = '';
				}
				this.nIndex = this.index;

				this.pages[this.oIndex].style.zIndex = this.zIndex;
				this.pages[this.index].style.zIndex = this.zIndex + 10;
				this.setTransform(this.index, this.dis);
				this.pages[this.index].style.display = 'block';

				this.setTransform(this.index, this.touch.disY + this.dis);
				if (this.effect === 'translate') this.setTransform(this.oIndex, this.touch.disY);
				if (this.effect === 'scale') this.setScale(this.oIndex, this.scale);

				this.move && this.move();
			}
		},
		touchEnd: function(e) {
			this.point = ''; //PC端 mousemove
			if (this.index === this.oIndex) return;
			if (this.touch.fixed === 'up') {
				var Y = Math.abs(this.touch.disY);
				if ((this.animated && Y > 10) || Y > this.height / 2) {
					this.slide();
				} else {
					this.recover();
				}
				this.end && this.end();
			}
		},
		setScale: function(index, v) {
			this.setStyle(this.pages[index], 'transform', 'scale(' + v + ')');
		},
		setOrigin: function(index, dir) {
			this.setStyle(this.pages[index], 'transform-origin', dir);
		},
		setTransform: function(index, v) {
			v = v || 0;
			this.setStyle(this.pages[index], 'transform', 'translate3d(0px,' + v + 'px,0px)');
		},
		setTransition: function(index, v) {
			v = v || 0;
			this.setStyle(this.pages[index], 'transition', 'all ' + v + 'ms');
		},
		setStyle: function(el, p, v) {
			!this.cache[el] && (this.cache[el] = {});
			!this.cache[el][p] && (this.cache[el][p] = this.prefix(p));
			el.style[this.cache[el][p] || this.prefix(p)] = v;
		},
		prefix: function(p) {
			var style = document.createElement('div').style;
			if (p in style) return p;
			var prefix = ['webkit', 'Moz', 'ms', 'O'],
				i = 0,
				l = prefix.length,
				s = '';
			for (; i < l; i++) {
				s = prefix[i] + '-' + p;
				s = s.replace(/-\D/g, function(match) {
					return match.charAt(1).toUpperCase();
				});
				if (s in style) return s;
			}
		},
		css: function(o, n) {
			return getComputedStyle(o, null)[n];
		},
		on: function(el, types, handler) {
			for (var i = 0, l = types.length; i < l; i++) el.addEventListener(types[i], handler, false);
		},
		slide: function() {
			var _this = this;
			this.animated = false;
			this.setTransition(this.index, this.duration);
			this.setTransition(this.oIndex, this.duration);
			this.setTransform(this.index, 0);
			if (this.effect === 'translate') this.setTransform(this.oIndex, -this.dis);
			if (this.effect === 'scale') this.setScale(this.oIndex, this.minScale);
			setTimeout(function() {
				if (_this.index !== _this.oIndex) _this.update();
				_this.animated = true;
			}, this.duration);
		},
		recover: function() {
			var _this = this;
			this.setTransition(this.index, 100);
			this.setTransition(this.oIndex, 100);
			this.setTransform(this.index, this.dis);
			if (this.effect === 'translate') this.setTransform(this.oIndex, 0);
			if (this.effect === 'scale') this.setScale(this.oIndex, 1);
			setTimeout(function() {
				_this.clear();
				_this.pages[_this.index].style.display = 'none';
				_this.index = _this.oIndex;
			}, 100);
		},
		update: function() {
			if (this.navShow) {
				this.navs[this.index].className = this.current;
				this.navs[this.oIndex].className = '';
			}
			this.pages[this.oIndex].style.display = 'none';
			this.pages[this.index].className += ' ' + this.current;
			this.pages[this.oIndex].className = this.pages[this.oIndex].className.replace(this.current, '').trim();
			this.clear();
			this.oIndex = this.index;
		},
		empty: function(index) {
			this.setStyle(this.pages[index], 'transform', '');
			this.setStyle(this.pages[index], 'transition', '');
			this.pages[index].style.zIndex = '';
		},
		clear: function() {
			this.empty(this.index);
			this.empty(this.oIndex);
			if (this.effect === 'scale') this.setOrigin(this.oIndex, '');
		},
		animate: function() {
			var _this = this;
			this.setTransform(this.index, this.dis);
			this.pages[this.index].style.display = 'block';
			this.pages[this.oIndex].style.zIndex = this.zIndex;
			this.pages[this.index].style.zIndex = this.zIndex + 10;
			this.setTransition(this.index, 0);
			this.setTransition(this.oIndex, 0);
			setTimeout(function() {
				_this.slide();
			}, 50); //处理自动播放时 动画时间不能及时发聩
		},
		up: function() {
			this.dis = this.height;
			this.index++;
			this.index > this.length - 1 && (this.index = 0);
			if (this.effect === 'scale') this.setOrigin(this.oIndex, 'center top');
			this.animate();
		},
		down: function() {
			this.dis = -this.height;
			this.index--;
			this.index < 0 && (this.index = this.length - 1);
			if (this.effect === 'scale') this.setOrigin(this.oIndex, 'center bottom');
			this.animate();
		},
		play: function() {
			var _this = this;
			if (this.locked) return;
			this.timer = setInterval(function() {
				_this.up();
			}, this.delay);
		},
		stop: function() {
			this.timer && clearInterval(this.timer);
			this.timer = null;
		}
	};
}());