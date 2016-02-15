brushes = {
	dig: {label: 'Dig', code: 'd', className: 'dig'},
	clear: {label: 'Clear', code: '', className: ''},
	chop: {label: 'Chop', code: 't', className: 'chop'},
	downstairs: {label: 'Down stairs', code: 'i', className: 'downstairs'},
	updownstairs: {label: 'Up Down stairs', code: 'j', className: 'updownstairs'},
	upstairs: {label: 'Up stairs', code: 'k', className: 'upstairs'},
};


function Range(x1, x2, y1, y2){
	if(arguments.length == 2){
		y1 = x2;
		x2 = y2 = 0;
	}
	return function(f){
		for(var x=Math.min(x1,x2); x<=Math.max(x1,x2); x++) 
			for(var y=Math.min(y1, y2); y<=Math.max(y1, y2); y++)
				f(x, y);
		};
}


_model_id = 0;

function Array2D(x, y){
	this.x = x;
	this.y = y;	
	this.cells = new Array(this.x);	
	var cells = this.cells;
	for(var i=0;i<this.x;i++)
		cells[i] = new Array(this.y);	
	this.get = function(x, y){
		return cells[x][y];
	}
	this.set = function(x, y, v){
		cells[x][y] = v;
	}
	this.pop = function(x){
		return cells[x].pop();
	}
	this.push = function(x, v){
		return cells[x].push(v);
	}
	this.toJSON = function(){
		return cells;
	}		
	this.load = function(new_cells){
		this.cells = cells = new_cells;
		this.x = cells.length;
		this.y = this.x ? cells[0].length : 0;
	}		
}
Array2D.prototype.set_size = function(x, y){	
	for(var i=this.x;i<x;i++){	
		this.cells.push(new Array(y));
	}
	for(var i=0;i<x;i++)
		this.cells[i].length = y;	
	this.x = x;
	this.y = y;
};	

function Level(x, y){
	Array2D.apply(this, arguments);
	var cells = this.cells;
	this.level_id = _model_id++;
	
	this.listeners = {
		cells: [],
		size: []
	};
	this.get = function(x, y){
		return this.cells[x][y] = this.cells[x][y] || {};
	}
	this.update = function(x, y, data){
		var obj = this.get(x, y);
		for(var k in data)
			obj[k] = data[k];
	    this.listeners.cells.forEach(function(e){
	    	e(x, y, obj);
	    });
	}
	this.set_size = function(x, y){	
		Array2D.prototype.set_size.apply(this, arguments);
	    this.listeners.size.forEach(function(e){
	    	e();
	    });
	}
	this.listen = function(events){
		if(events.size)
			this.listeners.size.push(events.size);
		if(events.cells)
			this.listeners.cells.push(events.cells);
	};

}
Level.prototype = Object.create(Array2D.prototype);
Level.prototype.constructor = Level;


function Model(){
	this.levels = [];
	this.add_level = function(x, y){
		var level = new Level(x, y);
		this.levels.push(level);
		return level;
	}
	this.get_level = function(i){
		return this.levels[i];
	},
	this.set_size = function(x, y){
		this.levels.forEach(function(level){
			level.set_size(x, y);
		});
	}
	this.toJSON = function(){
		return this.levels.map(function(e){ return e.toJSON(); });
	}
	this.load= function(data){
		var levels = this.levels;
		levels.length = 0;
		data.forEach(function(e){
			var level = new Level(0,0);
			level.load(e);
			levels.push(level);
		});
	}

}

function LevelView(level){
	var el = document.createElement('table'),
		x = level.x,
		y = level.y;
	var cells = new Array2D(x ,y);
	var addClass = function(el, data){
		el.className = '';
		for(k in data){
			if(data[k])
				if(k !== 'value')
					el.classList.add(k);	
				else if(k === 'value' && brushes[data[k]].className){
					el.classList.add(brushes[data[k]].className);
				}
		}

	};
	var create_cell = function(row, x ,y){
		var cell = row.insertCell(-1);
		cell.title ='('+y+','+x+')';
		cell.watched = true;
		var data = level.get(x, y);
		cell.x=x; cell.y=y;
		addClass(cell, data);
		return cell;		
	}

	for(var i=0;i<x;i++){
		var row = el.insertRow(-1);
		for(var j=0;j<y;j++){
			cells.set(i, j, create_cell(row, i ,j)); 
		}
	}
	var resize = function(){
		el.style.height = (el.offsetWidth * (y/x)) +"px";
	}

	window.addEventListener('resize', resize);
	this.events = {
		cells: function(x, y, data){
			addClass(cells.get(x,y), data);
		},
		size: function(){
			var i,j;
			for(i=0;i<level.x && i < x;i++){
				for(j=y-1;j>=level.y;j--){
					cells.get(i,0).parentNode.removeChild(cells.pop(i));	
				}
				for(j=y;j<level.y;j++){
					cells.push(i,create_cell(cells.get(i,0).parentNode, i,j));
					
				}				
			}
			cells.set_size(level.x, level.y);
			for(i=x;i<level.x;i++){
				var row = el.insertRow(-1);
				for(j=0;j<level.y;j++){
					cells.set(i, j, create_cell(row, i ,j)); 
				}
			}
			for(i=x-1;i>=level.x;i--)
				cells.get(i,0).parentNode.parentNode.removeChild(cells.get(i,0).parentNode);	
			x = level.x;
			y = level.y;
		}
	};
	level.listen(this.events);
	this.el = el;
	this.cells = cells;
	this.insert = function(parent){
		parent.appendChild(el);
		resize();
	};
	this.unlisten = function(){
		// /this.array.slice()
	};

}	

function LevelOutputView(level){
	var el = document.createElement('pre');
	var timer;
	render = function(el, level){
		var str = '';
		Range(0, level.x-1, 0, level.y-1)(
			function(x, y){
			str += level.get(x, y).selected ? 'C' : 'N';
			str += (y===level.x-1) ? '\n': ',';
		});
		el.innerHTML = str;
	};
	render_delay = function(el, level){
		if(timer)
			clearTimeout(timer);
		timer = setTimeout(function(){
			render(el, level);
		}, 1000)
	}
	level.listen({
		cells: function(x, y, data){
		render_delay(el, level);
	}})
	this.el = el;
	this.render = function(){
		render(el, level);
	}
	this.insert = function(parent){
		parent.appendChild(el);
	
	};		
}

function LevelCanvasView(level){
	var el = document.createElement('canvas');
	var ctx = el.getContext('2d');
	el.width= 600;
	el.height= 600;
	var timer;
	render = function(el, level){
		var img = ctx.createImageData(level.x,level.y);
		var d  = img.data;   
		Range(0, level.x-1, 0, level.y-1)(
			function(x, y){
				if(level.get(x, y).value)
					d[(x +y*level.x) +0] = 255;
		});
		ctx.putImageData(img);
	};
	render_delay = function(el, level){
		if(timer)
			clearTimeout(timer);
		timer = setTimeout(function(){
			render(el, level);
		}, 1000)
	}
	level.listen({
		cells: function(x, y, data){
		render_delay(el, level);
	}})
	this.el = el;
	this.render = function(){
		render(el, level);
	}
	this.insert = function(parent){
		parent.appendChild(el);

	};
	this.el = el;		
}


function LevelController(level){
	var self = this;
	var view = new LevelView(level)
	var mousedown;
	var drag_start;
	var hover;
	var selection = [];
	this.events = {
		'mousedown': function(event){
			if(event.srcElement.watched){
				mousedown = true;
				drag_start = event.srcElement;
				self.prev_drag = null;
			}
		},
		'mouseup': function(event){
			mousedown = false;
			

			if(self.prev_drag){
				selection.push(self.prev_drag);
				self.prev_drag(function(x, y){
					level.update(x, y, {'selected':true, 'select_pending': false});
				})
			}
			self.prev_drag = null;
		},
		'mouseleave': function(event){
			if(event.srcElement === view.el)
			mousedown = false;
		
		},		
		'mousemove': function(event){
			if(event.srcElement.watched && mousedown){
				self.drag(event.srcElement);		   
			}
		},			
		'mouseover': function(event){
			if(hover)
				hover.classList.remove('hover');
			hover = null;
			event.srcElement.classList.add('hover');
			hover = event.srcElement;
		},
	};

	this.el = view.el;

	this.insert = function(el){
		this.parent = el;
		view.insert(el);
		return view.el;
	};
	this.remove = function(){
		this.parent.removeChild(view.el);
	}
	this.listen = function(){
		for(var ev in this.events){
			view.el.addEventListener(ev, this.events[ev]);
		}
		return this;
	};
	this.unlisten = function(){
		for(var ev in this.events){
			view.el.removeEventListener(ev, this.events[ev]);
		}
		return this;
	}	
	this.drag = function(el){
		if(this.prev_drag)
			this.prev_drag(function(x, y){
				level.update(x, y, {'select_pending': false});
			})
		this.prev_drag = Range(el.x, drag_start.x, el.y, drag_start.y)
   		this.prev_drag(function(x, y){
				level.update(x, y, {'select_pending':true});
			});
	};
	this.brush = function(value){
		selection.forEach(function(range){
			range(function(x, y){
				if(level.get(x, y).selected){
					level.update(x, y, {selected: false, value: value});
				}
			});
		});
	}
}


function OutputController(level){
	var view = new LevelOutputView(level);
	this.insert = function(el){
		this.parent = el;
		this.parent.appendChild(view.el);
		view.render();
		return view.el;
	};	
}


function main(){
	var model = new Model();
	var controllers = [];
	var main_controller;
	var outputs = [];

	var main_view = document.getElementById('main_view');
	var scroll_view = document.getElementById('scroll_view');
	var output_view = document.getElementById('output_view');


	var button_x = document.getElementById('level_size_x');
	var button_y = document.getElementById('level_size_y');
	var button_save = document.getElementById('save_fortress');
	var button_load = document.getElementById('load_fortress');
	var brush = document.getElementById('brush');
	var button_place = document.getElementById('place');
	var level_x = 50, level_y = 50;
	button_x.value = level_x;
	button_y.value = level_y;




	var level_selected = function(level){
		if(main_controller)
			main_controller.unlisten().remove();
		main_controller = new LevelController(level);
		main_controller.insert(main_view);
		main_controller.listen();
	}
	var add_level_event = function(event){
		return add_level(model.add_level(level_x, level_y));
	}
	var add_level = function(level){
		var controller = new LevelController(level);
		controller.insert(scroll_view);
		controllers.push(controller);	
		var output = new OutputController(level);
		output.insert(output_view);
		outputs.push(output);
		controller.el.addEventListener('click', function(){
			level_selected(level);
		});
		return controller;
	}
	var place = function(){
		if(main_controller)
			main_controller.brush(brush.value);
	};
	var save = function(){
		localStorage['fortress'] = JSON.stringify(model.toJSON());
	};
	var load = function(){
		if(main_controller)
			main_controller.unlisten().remove();
		controllers.forEach(function(controller){
			controller.unlisten().remove();
		})	
		controllers.length = 0;	
		var data = JSON.parse(localStorage['fortress']);
		model = new Model(0,0);
		model.load(data);

		main_controller = null;		
		level_x = button_x.value = model.get_level(0).x;
		level_y = button_y.value = model.get_level(0).y;
		model.levels.forEach(function(level){
			add_level(level);
		});
		level_selected(model.levels[0]);
	}
	var level_xy = function(){
		level_x = parseInt(button_x.value, 10);
		level_y = parseInt(button_y.value, 10);
		model.set_size(level_x, level_y);
	}
	var setup_controls = function(){
		for(var b in brushes){
			var option = document.createElement("option");
			option.value = b;
			option.label = brushes[b].label;
			brush.add(option);
		}
		document.getElementById('add_level').addEventListener('click', add_level_event);
		button_x.addEventListener('change', level_xy);
		button_y.addEventListener('change', level_xy);
		button_save.addEventListener('click', save);
		button_load.addEventListener('click', load);
		button_place.addEventListener('click', place);
		document.addEventListener('keypress', function(event){
			event.preventDefault();
			switch(event.keyCode){
				case(32):
					place();
					break;
				default:

			}
		});
	};



	(function(){
		setup_controls();
		var lev = model.add_level(level_x, level_y);
		add_level(lev);
		level_selected(lev);
	})();



	window.debug_model = model;
}



