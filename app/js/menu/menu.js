/**
 * This generates the main menu
 */
define(
	[
		"lodash", "jquery", "backbone", "storage/storage", "storage/defaults", "i18n/i18n", "search/search",
		"search/speech", "settings/settings", "widgets/store", "modals/donate", "core/uservoice", "core/render"
	],
	function(_, $, Backbone, Storage, Defaults, Translate, Search, Speech, Settings, Store, Donate, UserVoice, render) {
		var Model = Backbone.Model.extend({
				init: function() {
					Storage.on("done updated", function(storage) {
						this.storage = storage;

						var set = _.clone(storage.settings);

						set.tabs = _.map(storage.tabs, function(e, i) {
							return {
								id: e.id,
								name: e.name || Defaults.tab.name
							};
						});

						this.storage = storage;

						if (JSON.stringify(set) !== JSON.stringify(this.toJSON())) {
							this.set(set);
						}
					}, this);
				}
			}),
			View = Backbone.View.extend({
				tagName: "div",
				className: "menu-container",

				events: {
					"click [data-item]:not(.active)": "effectuate",

					"click .tabs .add": function() {
						if (!this.Settings) {
							this.Settings = new Settings();
						}

						this.Settings.createTab();
					},
					"click .footer .donate": function(e) {
						e.preventDefault();

						if (!this.Donate) {
							this.Donate = new Donate();
						}
						else {
							this.Donate.show();
						}
					},
					"click .footer .support": function(e) {
						e.preventDefault();

						UserVoice("show", { mode: "contact" });
					},
					"click .footer .feedback": function(e) {
						e.preventDefault();

						UserVoice("show", { mode: "satisfaction" });
					}
				},


				/**
				 * Handles the menu item click event and triggers the appropriate handler.
				 *
				 * Slightly obscurely, but aptly named.
				 *
				 * @api    private
				 * @param  {Event} e The event
				 */
				effectuate: function(e) {
					var elm = $(e.currentTarget);

					switch (elm.attr("data-item")) {
						case "settings":
							if (!this.Settings) {
								this.Settings = new Settings();
							}

							this.Settings.show();
							// This delays displaying the modal until after the init JS is done so the animation is smooth
							requestAnimationFrame(this.Settings.show.bind(this.Settings));
						break;

						case "widgets":
							if (!this.Store) {
								this.Store = new Store();
							}

							// See above
							requestAnimationFrame(this.Store.show.bind(this.Store));
						break;

						case "view":
							$(document.body).prepend(
								'<style id="theme-view-style-elm">' +
									'body > * {' + 
										'opacity: 0!important;' +
										'pointer-events: none;' +
										'transition: opacity .3s ease-in-out!important;' +
									'}' +
								'</style>'
							);

							var startX = e.clientX,
								startY = e.clientY;

							// This delays the attaching till after the events have finished bubbling, otherwise mousemove will get called immediately
							requestAnimationFrame(function() {
								$(document.body).on("mousemove.menu", function(e) {
									if (Math.abs(e.clientX - startX) >= 30 || Math.abs(e.clientY - startY) >= 30) {
										$(document.body).off("mousemove.menu");

										var tStyle = $("#theme-view-style-elm").html(
											"body > * {" +
												"transition: opacity .3s ease-in-out!important;" +
											"}"
										);

										setTimeout(function() { tStyle.remove(); }, 300);
									}
								});
							});
						break;

						case "editmode":
							e.stopPropagation();

							var state = elm.find(".state");

							if (state.hasClass("enabled")) {
								state.removeClass("enabled").text(Translate("menu.editing_disabled"));

								this.model.storage.settings.editing = false;
							}
							else {
								state.addClass("enabled").text(Translate("menu.editing_enabled"));

								this.model.storage.settings.editing = true;
							}

							$(document.body).toggleClass("no-edit", !this.model.storage.settings.editing);

							this.model.storage.sync();
						break;

						case "link":
							if (elm.hasClass("custom") && elm.attr("href").indexOf("chrome") == 0) {
								e.preventDefault();

								chrome.tabs.getCurrent(function(d) {
									if (e.which == 2) {
										chrome.tabs.create({
											url: href,
											index: d.index + 1
										});
									}
									else {
										chrome.tabs.update(d.id, {
											url: href
										});
									}
								});
							}
						break;

						case "tab":
							this.navigate(e.currentTarget);

							this.trigger("navigate", parseInt(elm.attr("data-id")));
						break;
					}
				},


				/**
				 * Updates the tabs menu to the freshly navigated tab
				 *
				 * @api    public
				 * @param  {Number|String|Element} which  The tab ID or menu element
				 * @param  {Backbone.View}         view   The tab view
				 * @param  {Backbone.Model}        model  The tab model
				 */
				navigate: function(which, view, model) {
					if (typeof which == "string" || typeof which == "number") {
						this.$(".section.tabs div[data-id=" + ((model && model.get("id")) || (which + 1)) + "]").addClass("active").siblings().removeClass("active");
					}
					else {
						$(which).addClass("active").siblings().removeClass("active");
					}
				},


				/**
				 * Shows the menu
				 *
				 * @api    public
				 */
				show: function() {
					this.toggle(true);
				},


				/**
				 * Hides the menu
				 *
				 * @api    public
				 */
				hide: function() {
					this.toggle(false);
				},


				/**
				 * Toggles the menu's visibility
				 *
				 * @api    public
				 */
				toggle: function(show) {
					if (typeof show !== "boolean") {
						show = undefined;
					}

					if (!this.$el.hasClass("visible") && (typeof show == "undefined" || show === true)) {
						// If this doesn't include the toggle switch the event will bubble to the body which will in turn re-hide the menu
						var elms = this.$el.parent();

						elms = elms.find("*").add(elms);

						$(document.body).on("click.menu", function(e) {
							if (!elms.is(e.target)) {
								this.$el.removeClass("visible");

								$(document.body).off("click.menu");
							}
						}.bind(this));

						this.$el.addClass("visible");
					}
					else if (this.$el.hasClass("visible") && !show) {
						$(document.body).off("click.menu");

						this.$el.removeClass("visible");
					}
				},


				initialize: function() {
					this.model = new Model();

					// init() needs to be called after the listener is attached to prevent a race
					// condition when storage is already loaded.  It also needs to be here instead
					// of attached directly to new Model() otherwise this.model might not be set yet.
					this.model.on("change", this.render, this).init();
				},


				/**
				 * Initializes the navigate handler
				 *
				 * @api    private
				 * @param  {Function}       navigate  The navigation callback
				 * @return {Backbone.View}
				 */
				init: function(navigate) {
					return this.on("navigate", navigate);
				},


				render: function() {
					// This enables OK Google hotword detection even when there's only a menu and no toolbar
					if (this.model.get("ok") && !this.Speech) {
						this.Speech = new Speech();

						// This calls the search submit handler using the Speech model for settings
						this.Speech.on("result", Search.prototype.submit, this.Speech);
					}

					this.$el.html(render("menu", this.model.toJSON()));

					return this;
				}
			});

		return new View();
	}
);