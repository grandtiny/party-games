package §_-Gt§
{
   import §_-0H§.Player;
   import §_-1v§.§_-T9§;
   import §_-3i§.§_-Ep§;
   import §_-8S§.§_-RG§;
   import §_-Bv§.§_-DW§;
   import §_-G1§.§_-Bw§;
   import §_-Hp§.§_-E8§;
   import §_-Iw§.§_-Yj§;
   import §_-R0§.Direction;
   import §_-R0§.§_-7S§;
   import §_-S4§.§_-C§;
   import §_-S4§.§_-HL§;
   import §_-Us§.§_-IL§;
   import §_-VB§.§_-1B§;
   import §_-VB§.§_-2S§;
   import §_-n§.§_-Sv§;
   import common.CommonData;
   import common.Session;
   import common.Settings;
   import common.§_-4Y§;
   import common.§_-Ac§;
   import common.misc.Cookies;
   import common.misc.QzoneJSAPI;
   import common.misc.Utils;
   import common.view.window.§_-RW§;
   import flash.display.DisplayObject;
   import flash.display.MovieClip;
   import flash.display.Sprite;
   import flash.events.Event;
   import flash.events.EventDispatcher;
   import flash.events.MouseEvent;
   import flash.geom.Point;
   import flash.utils.clearTimeout;
   import flash.utils.setTimeout;
   import framework.api.§_-20§;
   import framework.net.protocol.§_-Vz§;
   import report.EventRecorder;
   import report.UserActionRecorder;
   
   public class §_-VT§ extends §_-Sv§
   {
      
      private var §_-J2§:int;
      
      private var _gift:int = 0;
      
      private var m_controller:§_-1B§;
      
      private var §_-P8§:int = 1;
      
      private var §_-19§:§_-RW§;
      
      private var _qzonegift:§_-IL§;
      
      private var monthend_timer:uint;
      
      private var §_-5g§:§_-HL§;
      
      public function §_-VT§(param1:§_-1B§)
      {
         super(500,62);
         x = 5;
         y = 68;
         §_-4R§ = §_-7S§.LEFT;
         gapH = 0;
         gapV = 0;
         verticalScrollPolicy = §_-RG§.§_-YA§;
         backgroundAlpha = 0;
         defaultSkin = null;
         this.§_-19§ = null;
         this.m_controller = param1;
         this.§_-3M§();
         this.§_-9A§();
         §_-20§.getInstance().amountPlugins(§_-Ac§.§_-TQ§,this,null);
         addEventListener(MouseEvent.MOUSE_OVER,this.onMouseOver,false,0,true);
         addEventListener(MouseEvent.MOUSE_OUT,this.onMouseOut,false,0,true);
         addEventListener(MouseEvent.CLICK,this.onClicked,false,0,true);
         this.m_controller.module.app.addEventListener(§_-Ac§.§_-BO§,this.onMyFlowerLoaded,false,0,true);
         this.m_controller.module.app.addEventListener(§_-Ac§.DELEVE_NEW_ICON,this.removeNewIconTip,false,0,true);
         this.m_controller.module.app.addEventListener(§_-T9§.§_-Kg§,this.freeGiftCountOut,false,0,true);
         this.m_controller.module.app.addEventListener(§_-DW§.§_-Dx§,this.onMonthEndOpen,false,0,true);
         var _loc2_:EventDispatcher = this.m_controller.model as EventDispatcher;
         _loc2_.addEventListener(§_-2S§.§_-Gd§,this.onDataChanged,false,0,true);
         _loc2_.addEventListener(§_-2S§.§_-Kd§,this.onSystemPostLoaded,false,0,true);
         _loc2_.addEventListener(§_-2S§.§_-DI§,this.onEverydayGiftLoaded,false,0,true);
         _loc2_.addEventListener(§_-2S§.§_-DU§,this.onOfflineDataMessageLoaded,false,0,true);
         _loc2_.addEventListener(§_-2S§.§_-AF§,this.onGetVipReturnGift,false,0,true);
         _loc2_.addEventListener(§_-2S§.GET_CARDSGAME_DATA,this.onGetCardsGameData,false,0,true);
         _loc2_.addEventListener(§_-2S§.§_-WY§,this.onShowWarnMsg,false,0,true);
         _loc2_.addEventListener(§_-2S§.§_-N9§,this.onLevelUp,false,0,true);
         _loc2_.addEventListener(§_-2S§.§_-Uc§,this.getFreeGiftHandler,false,0,true);
         this.m_controller.module.app.addEventListener(§_-Ac§.§_-BJ§,this.onQzonegift,false,0,true);
      }
      
      private function onShowWarnMsg(param1:§_-Yj§) : void
      {
         this.openPostWindow();
         EventRecorder.recordErrorEvent(EventRecorder.CHEAT_FARM,0,EventRecorder.SUEECSS);
      }
      
      public function onGetCardsGameData(param1:§_-Yj§) : void
      {
         var _loc2_:Boolean = param1.data as Boolean;
         if((Session.getInstance().remainPlays > 0 || Session.getInstance().§_-8J§ > 0) && _loc2_)
         {
            this.cardsGame = true;
         }
         else
         {
            this.cardsGame = false;
            this.§_-TO§();
         }
      }
      
      public function set msg(param1:Boolean) : void
      {
      }
      
      private function monthEndClick() : void
      {
         var _loc1_:MovieClip = null;
         if(!this.§_-5g§)
         {
            this.§_-5g§ = new §_-HL§(this.m_controller);
            _loc1_ = this.getChildByName("__monthendarrow__") as MovieClip;
            if(_loc1_)
            {
               removeChild(_loc1_);
               _loc1_ = null;
            }
            Cookies.setObject("monthend_" + Session.getInstance().host._uId,CommonData.serverTime);
         }
         §_-Bw§.§_-V6§(this.§_-5g§,true);
         this.§_-5g§.openWindows();
      }
      
      private function onEverydayGiftLoaded(param1:§_-Yj§) : void
      {
         if(param1 == null || param1.data == null)
         {
            return;
         }
         var _loc2_:Object = param1.data;
         _loc2_["big"] = false;
         if(_loc2_["claimed"] == true)
         {
            _loc2_["confirmHandler"] = null;
         }
         else
         {
            _loc2_["confirmHandler"] = this.giftWindowConfirmHandler;
         }
         this.m_controller.openWindow(§_-Ac§.§_-LP§,_loc2_);
      }
      
      private function §_-TO§() : void
      {
         var _loc3_:int = 0;
         if(content == null)
         {
            return;
         }
         var _loc1_:Array = [];
         var _loc2_:DisplayObject = null;
         while(_loc3_ < content.numChildren)
         {
            _loc2_ = content.getChildAt(_loc3_);
            _loc1_.push(_loc2_);
            _loc3_++;
         }
         enableValidate = false;
         removeAllElements();
         for each(_loc2_ in _loc1_)
         {
            addElement(_loc2_);
         }
         enableValidate = true;
         validateNow();
      }
      
      private function openPostWindow() : void
      {
         var _loc2_:MovieClip = null;
         var _loc3_:String = null;
         var _loc4_:String = null;
         var _loc1_:* = this.m_controller.model.§_-Kx§();
         if(_loc1_ != null)
         {
            if(_loc1_["content"] != undefined)
            {
               _loc3_ = _loc1_["content"] as String;
               if(_loc3_ == "" || _loc3_ == null)
               {
                  return;
               }
               if(this.§_-19§ == null)
               {
                  this.§_-19§ = new §_-RW§(null,§_-4Y§.§_-Kf§["确定"]);
                  this.§_-19§.title = "";
                  this.§_-19§.closeFn = this.onPostWindowClosed;
               }
               this.§_-19§.text = _loc3_;
               this.m_controller.module.app.farmView.winCtrl.open(this.§_-19§);
               this.m_controller.module.app.useSystemCursor(true);
               Cookies.setObject("postText",_loc3_);
               Cookies.setObject("postClicked",true);
            }
            else if(_loc1_["imageurl"] != undefined)
            {
               _loc4_ = _loc1_["imageurl"] as String;
               if(_loc4_ == "" || _loc4_ == null)
               {
                  return;
               }
               if(this.§_-19§ == null)
               {
                  this.§_-19§ = new §_-RW§(null,§_-4Y§.§_-Kf§["确定"]);
                  this.§_-19§.title = "";
                  this.§_-19§.closeFn = this.onPostWindowClosed;
               }
               this.§_-19§.imgUrl = _loc4_;
               this.m_controller.module.app.farmView.winCtrl.open(this.§_-19§);
               this.m_controller.module.app.useSystemCursor(true);
               Cookies.setObject("postImage",_loc4_);
               Cookies.setObject("postImageClicked",true);
            }
            EventRecorder.recordSueecssEvent(EventRecorder.HF_POSTVIEW,0);
            _loc2_ = content.getChildByName("__post__") as MovieClip;
            _loc2_.gotoAndStop(1);
         }
      }
      
      private function freeGiftCountOut(param1:§_-Ep§) : void
      {
         var _loc2_:MovieClip = content.getChildByName("__freegift__") as MovieClip;
         _loc2_["init"](CommonData.freeGift);
      }
      
      private function onMonthEndOpen(param1:Event) : void
      {
         this.monthEndClick();
      }
      
      private function onQzonegift(param1:Event) : void
      {
         if(!this._qzonegift)
         {
            this._qzonegift = new §_-IL§(this.m_controller);
         }
         §_-Bw§.§_-V6§(this._qzonegift,true);
      }
      
      public function set flower(param1:Boolean) : void
      {
         var _loc2_:Sprite = content.getChildByName("__flower__") as Sprite;
         if(param1 == true)
         {
            if(_loc2_ == null)
            {
               _loc2_ = Utils.getMaterial("FlowerIcon") as Sprite;
               _loc2_.name = "__flower__";
               _loc2_.mouseChildren = false;
               _loc2_.buttonMode = true;
               addElement(_loc2_);
            }
         }
         else if(_loc2_ != null)
         {
            removeElement(_loc2_);
         }
      }
      
      private function onLevelUpGift(param1:§_-Yj§) : void
      {
         if(param1 == null || param1.data == null)
         {
            return;
         }
         var _loc2_:* = param1.data;
         var _loc3_:Array = new Array();
         if(_loc2_.hasOwnProperty("item") == true)
         {
            _loc2_["big"] = false;
            this.m_controller.module.app.openWindowByName(§_-Ac§.§_-LP§,_loc2_);
            this.m_controller.module.app.hideTip();
            _loc3_ = _loc3_.concat(_loc2_["item"]);
         }
         if(_loc2_.hasOwnProperty("vipItem") == true && _loc2_["vipItem"] != false)
         {
            _loc3_ = _loc3_.concat(_loc2_["vipItem"]);
         }
         Session.getInstance().§_-WD§(_loc3_);
      }
      
      private function getFreeGiftHandler(param1:§_-Yj§) : void
      {
         var freeIcon:FreeGiftIcon = null;
         var _arrow:MovieClip = null;
         var e:§_-Yj§ = param1;
         if(e.data["show"] == 1)
         {
            freeIcon = new FreeGiftIcon();
            if(freeIcon != null)
            {
               freeIcon.name = "__freegift__";
               freeIcon.buttonMode = true;
               freeIcon.stop();
               addElement(freeIcon);
               freeIcon["init"](e.data);
               if(§_-T9§.§_-D§(Session.getInstance().host._uId))
               {
                  _arrow = this.getChildByName("__freegiftarrow__") as MovieClip;
                  if(_arrow == null)
                  {
                     _arrow = Utils.getMaterial("monthEndArrow") as MovieClip;
                     _arrow.name = "__freegiftarrow__";
                     _arrow.tipMc.tip.text = "礼物更新喽~";
                     addChild(_arrow);
                  }
                  _arrow.x = freeIcon.x + 35;
                  _arrow.y = freeIcon.y + 30;
                  _arrow.mouseEnabled = false;
                  setTimeout(function():void
                  {
                     if(_arrow)
                     {
                        if(_arrow.parent)
                        {
                           _arrow.parent.removeChild(_arrow);
                           _arrow = null;
                        }
                     }
                  },5000);
                  Cookies.setObject("freegift_new_" + Session.getInstance().host._uId,"true");
               }
            }
            CommonData.freeGift = e.data;
         }
      }
      
      private function onPostWindowClosed(param1:Event) : void
      {
         this.m_controller.module.app.useSystemCursor(false);
      }
      
      private function showYellowPackage(param1:Boolean) : void
      {
         var _loc1_:Object = this.m_controller.model.§_-QA§();
         if(_loc1_ == null)
         {
            return;
         }
         _loc1_["big"] = false;
         _loc1_["confirmHandler"] = _loc1_["claimed"] == true ? null : this.giftWindowConfirmHandler;
         this.m_controller.openWindow(§_-Ac§.§_-LP§,_loc1_);
      }
      
      private function onOfflineDataMessageLoaded(param1:§_-Yj§) : void
      {
         if(param1 == null || param1.data == null)
         {
            return;
         }
         this.§_-P8§ = param1.data as int;
      }
      
      private function isNewUserToday() : Boolean
      {
         var _loc1_:Boolean = false;
         if(Cookies.getObject("new_user_" + Session.getInstance().host._uId) == null)
         {
            return false;
         }
         var _loc2_:Date = new Date(CommonData.serverTime * 1000);
         var _loc3_:Date = new Date(Number(Cookies.getObject("new_user_" + Session.getInstance().host._uId)) * 1000);
         if(_loc2_.getFullYear() == _loc3_.getFullYear())
         {
            if(_loc2_.getMonth() == _loc3_.getMonth())
            {
               if(_loc2_.getDate() == _loc3_.getDate())
               {
                  _loc1_ = true;
               }
            }
         }
         return _loc1_;
      }
      
      private function §_-3M§() : void
      {
         enableValidate = false;
         var _loc1_:MovieClip = null;
         _loc1_ = Utils.getMaterial("InformationIcon") as MovieClip;
         if(_loc1_ != null)
         {
            _loc1_.name = "__info__";
            _loc1_.buttonMode = true;
            _loc1_.stop();
            addElement(_loc1_);
         }
         if(Settings.getInstance().mode != "" && QzoneJSAPI.QPLUS == false)
         {
            this.m_controller.model.§_-ZG§();
         }
         if(§_-C§.gi().isGiftTime())
         {
            this.monthend_timer = setTimeout(this.monthEndFn,1000);
         }
         enableValidate = true;
         validateNow();
      }
      
      private function onGetVipReturnGift(param1:§_-Yj§) : void
      {
         this.gift = Session.getInstance().§_-6§ == true ? 1 : 0;
      }
      
      public function set post(param1:Boolean) : void
      {
         var _loc2_:MovieClip = content.getChildByName("__post__") as MovieClip;
         if(param1 == true)
         {
            if(_loc2_ == null)
            {
               _loc2_ = Utils.getMaterial("PostIcon") as MovieClip;
               _loc2_.name = "__post__";
               _loc2_.gotoAndStop(1);
               _loc2_.mouseChildren = false;
               _loc2_.buttonMode = true;
               addElement(_loc2_);
            }
            this.m_controller.model.§_-Kx§();
         }
         else if(_loc2_ != null)
         {
            removeElement(_loc2_);
         }
      }
      
      private function onClicked(param1:MouseEvent) : void
      {
         var _loc3_:* = undefined;
         if(param1 == null || param1.target == null)
         {
            return;
         }
         var _loc2_:String = param1.target.name;
         if(_loc2_ == "__info__")
         {
            this.m_controller.model.§_-E3§();
            this.m_controller.module.app.dispatchEvent(new §_-Yj§(§_-Ac§.§_-Bt§,{"index":0}));
            UserActionRecorder.recordAction(UserActionRecorder.HF_SHORTCUTBAR_INFO_CLICKED);
         }
         else if(_loc2_ == "__freegift__")
         {
            if(int(CommonData.freeGift["unread"]) >= 1)
            {
               this.m_controller.module.app.dispatchEvent(new §_-Yj§(§_-Ac§.§_-CK§,{"openIndex":1}));
            }
            else
            {
               this.m_controller.module.app.dispatchEvent(new §_-Yj§(§_-Ac§.§_-CK§,{"openIndex":0}));
            }
         }
         else if(_loc2_ == "__post__")
         {
            this.openPostWindow();
            UserActionRecorder.recordAction(UserActionRecorder.HF_SHORTCUTBAR_POST_CLICKED);
         }
         else if(_loc2_ == "__gift__")
         {
            if(this.§_-J2§ == 2)
            {
               _loc3_ = this.m_controller.model.§_-QA§();
               if(_loc3_ != null)
               {
                  _loc3_["big"] = false;
                  if(_loc3_["claimed"] == true)
                  {
                     _loc3_["confirmHandler"] = null;
                  }
                  else
                  {
                     _loc3_["confirmHandler"] = this.giftWindowConfirmHandler;
                  }
                  this.m_controller.openWindow(§_-Ac§.§_-LP§,_loc3_);
               }
            }
            else
            {
               this.showYellowPackage(this._gift > 0);
            }
         }
         else if(_loc2_ == "__flower__")
         {
            this.m_controller.module.app.dispatchEvent(new §_-Yj§(§_-Ac§.§_-Rl§,{"openWithFlower":true}));
         }
         else if(_loc2_ == "__cards__")
         {
            this.m_controller.module.app.dispatchEvent(new §_-Yj§(§_-Ac§.§_-BS§,null));
            UserActionRecorder.recordAction(UserActionRecorder.HF_SHORTCUTBAR_CARDS_CLICKED);
         }
         else if(_loc2_ == "__levelup__")
         {
            if(this.m_controller.model.§_-1W§() == true)
            {
               this.m_controller.model.addEventListener(§_-2S§.§_-KI§,this.onLevelUpGift,false,0,true);
            }
         }
         else if(_loc2_ == "__monthEnd__")
         {
            this.monthEndClick();
         }
      }
      
      private function giftWindowConfirmHandler() : void
      {
         var _loc1_:Object = null;
         if(Session.getInstance().§_-6§)
         {
            this.m_controller.model.§_-Be§(true);
         }
         else
         {
            this.m_controller.model.§_-Be§(false);
         }
         _loc1_ = this.m_controller.model.§_-QA§();
         if(_loc1_ != null)
         {
            _loc1_["claimed"] = true;
            _loc1_["direction"] = "今日每日礼包已经领取。";
            _loc1_["item"] = [];
            _loc1_["vipItem"] = [];
            _loc1_["confirmHandler"] = null;
         }
         this.gift = 0;
      }
      
      private function onDataChanged(param1:§_-Yj§) : void
      {
         if(param1 == null || param1.data == null)
         {
            return;
         }
         var _loc2_:§_-E8§ = param1.data as §_-E8§;
         if(_loc2_ == null)
         {
            return;
         }
         this.information = _loc2_.§_-Ly§ > 0 ? true : false;
         this.msg = _loc2_.§_-Ba§ > 0 ? true : false;
         this.post = _loc2_.§_-9f§ > 0 ? true : false;
         if(_loc2_.§_-Ty§ == 3)
         {
            this.gift = 2;
         }
         else if(this.isNewUserToday())
         {
            this.gift = 2;
         }
         else
         {
            this.gift = _loc2_.§_-Ty§ > 0 || Session.getInstance().§_-6§ ? 1 : 0;
         }
         this.§_-J2§ = _loc2_.§_-Ty§;
         this.flower = _loc2_.§_-Lj§ > 0 ? true : false;
      }
      
      private function removeNewIconTip(param1:§_-Yj§) : void
      {
         var _loc2_:MovieClip = this.getChildByName("__newicontip__") as MovieClip;
         if(_loc2_)
         {
            this.removeChild(_loc2_);
            _loc2_ = null;
         }
      }
      
      private function onMyFlowerLoaded(param1:Event) : void
      {
         this.flower = false;
         this.§_-TO§();
      }
      
      private function onSystemPostLoaded(param1:§_-Yj§) : void
      {
         var _loc3_:String = null;
         var _loc4_:Boolean = false;
         var _loc5_:String = null;
         var _loc6_:Boolean = false;
         var _loc7_:MovieClip = null;
         var _loc8_:String = null;
         if(param1 == null || param1.data == null)
         {
            return;
         }
         var _loc2_:Object = param1.data;
         if(_loc2_["content"] != undefined || _loc2_["imageurl"] != undefined)
         {
            _loc3_ = null;
            _loc4_ = false;
            if(_loc2_["content"] != undefined)
            {
               _loc3_ = _loc2_["content"] as String;
               _loc4_ = true;
            }
            if(_loc2_["imageurl"] != undefined)
            {
               _loc3_ = _loc2_["imageurl"] as String;
            }
            _loc5_ = Cookies.getObject(_loc4_ ? "postText" : "postImage") as String;
            _loc6_ = Cookies.getObject(_loc4_ ? "postClicked" : "postImageClicked") as Boolean;
            _loc7_ = content.getChildByName("__post__") as MovieClip;
            _loc8_ = null;
            if(_loc3_ != null && _loc3_ != "" && _loc5_ != _loc3_)
            {
               if(_loc7_ != null)
               {
                  _loc7_.play();
               }
               Cookies.setObject(_loc4_ ? "postClicked" : "postImageClicked",false);
               _loc8_ = _loc2_["force_flag"] as String;
               if(_loc8_ == "1")
               {
                  this.openPostWindow();
               }
            }
            if(!_loc6_ && _loc8_ != "1")
            {
               if(_loc7_ != null)
               {
                  _loc7_.play();
               }
            }
         }
      }
      
      public function set information(param1:Boolean) : void
      {
         var _loc2_:MovieClip = content.getChildByName("__info__") as MovieClip;
         if(_loc2_ == null)
         {
            return;
         }
         if(param1 == true)
         {
            _loc2_.play();
         }
         else
         {
            _loc2_.gotoAndStop(1);
         }
      }
      
      private function §_-9A§() : void
      {
         var _loc1_:Boolean = true;
         var _loc2_:Date = new Date();
         var _loc3_:Date = null;
         _loc3_ = new Date(2012,0,19,23,59,59);
         if(_loc2_ > _loc3_)
         {
            _loc1_ = false;
         }
         else if(CommonData.serverTime * 1000 > _loc3_.time)
         {
            _loc1_ = false;
         }
         else
         {
            _loc1_ = true;
         }
      }
      
      private function monthEndFn() : void
      {
         var monthEnd:MovieClip;
         var _arrow:MovieClip = null;
         clearTimeout(this.monthend_timer);
         monthEnd = content.getChildByName("__monthEnd__") as MovieClip;
         if(monthEnd == null)
         {
            monthEnd = Utils.getMaterial("MonthEndIcon") as MovieClip;
            if(monthEnd != null)
            {
               monthEnd.name = "__monthEnd__";
               monthEnd.mouseChildren = false;
               monthEnd.buttonMode = true;
               addElement(monthEnd);
               if(CommonData.isMonthEndToday(Session.getInstance().host._uId))
               {
                  _arrow = this.getChildByName("__monthendarrow__") as MovieClip;
                  if(_arrow == null)
                  {
                     _arrow = Utils.getMaterial("monthEndArrow") as MovieClip;
                     _arrow.name = "__monthendarrow__";
                     if(Settings.getInstance().getMonthEnds("0","month"))
                     {
                        _arrow.tipMc.tip.text = Settings.getInstance().getMonthEnds("0","month") + "礼包\n火热促销中";
                     }
                     else
                     {
                        _arrow.tipMc.tip.text = "月末大礼包\n火热促销中";
                     }
                     addChild(_arrow);
                  }
                  _arrow.x = monthEnd.x + 35;
                  _arrow.y = monthEnd.y + 30;
                  _arrow.mouseEnabled = false;
                  setTimeout(function():void
                  {
                     if(_arrow)
                     {
                        if(_arrow.parent)
                        {
                           _arrow.parent.removeChild(_arrow);
                           _arrow = null;
                        }
                     }
                  },5000);
               }
            }
         }
      }
      
      private function onLevelUp(param1:§_-Yj§) : void
      {
         if(param1 == null || param1.data == null)
         {
            return;
         }
         var _loc2_:MovieClip = content.getChildByName("__levelup__") as MovieClip;
         var _loc3_:Array = param1.data as Array;
         if(_loc3_ == null || _loc3_.length == 0)
         {
            if(_loc2_ == null)
            {
               return;
            }
            removeElement(_loc2_);
            this.§_-TO§();
         }
         else if(_loc2_ == null)
         {
            _loc2_ = Utils.getMaterial("LevelUpIcon") as MovieClip;
            _loc2_.name = "__levelup__";
            _loc2_.buttonMode = true;
            _loc2_.stop();
            addElement(_loc2_);
         }
      }
      
      private function onMouseOut(param1:MouseEvent) : void
      {
         this.m_controller.hideTip();
      }
      
      public function set cardsGame(param1:Boolean) : void
      {
         var _loc2_:MovieClip = content.getChildByName("__cards__") as MovieClip;
         if(param1 == true)
         {
            if(_loc2_ == null)
            {
               _loc2_ = Utils.getMaterial("CardsGameIcon") as MovieClip;
               _loc2_.name = "__cards__";
               _loc2_.mouseChildren = false;
               _loc2_.buttonMode = true;
               addElement(_loc2_);
            }
         }
         else if(_loc2_ != null)
         {
            removeElement(_loc2_);
         }
      }
      
      public function set gift(param1:int) : void
      {
         this._gift = param1;
         var _loc2_:MovieClip = null;
         if(QzoneJSAPI.QPLUS == true)
         {
            return;
         }
         _loc2_ = content.getChildByName("__gift__") as MovieClip;
         if(_loc2_ == null)
         {
            _loc2_ = Utils.getMaterial("GiftIcon") as MovieClip;
            _loc2_.name = "__gift__";
            _loc2_.buttonMode = true;
            addElement(_loc2_);
         }
         if(param1 == 1)
         {
            if(Session.getInstance().host._yellowstatus.toString() != "0")
            {
               _loc2_.gotoAndPlay("GiftMove");
               return;
            }
            _loc2_.gotoAndStop(2);
         }
         else if(param1 == 2)
         {
            removeElement(_loc2_);
            this.§_-TO§();
         }
         else
         {
            if(Session.getInstance().host._yellowstatus.toString() != "0")
            {
               _loc2_.gotoAndStop(1);
               return;
            }
            _loc2_.gotoAndStop(2);
         }
      }
      
      private function onMouseOver(param1:MouseEvent) : void
      {
         if(param1 == null || param1.target == null)
         {
            return;
         }
         var _loc2_:String = param1.target.name;
         if(_loc2_ == "__info__")
         {
            this.m_controller.showTip(§_-Ac§.§_-B0§,"消息");
         }
         else if(_loc2_ == "__post__")
         {
            this.m_controller.showTip(§_-Ac§.§_-B0§,"公告");
         }
         else if(_loc2_ == "__gift__")
         {
            this.m_controller.showTip(§_-Ac§.§_-B0§,"礼包");
         }
         else if(_loc2_ == "__flower__")
         {
            this.m_controller.showTip(§_-Ac§.§_-B0§,"收到鲜花");
         }
         else if(_loc2_ == "__cards__")
         {
            this.m_controller.showTip(§_-Ac§.§_-B0§,"点击签到赢奖励");
         }
         else if(_loc2_ == "__levelup__")
         {
            this.m_controller.showTip(§_-Ac§.§_-B0§,"领取升级礼包");
         }
         else if(_loc2_ == "__freegift__")
         {
            if(CommonData.freeGift["unread"] == 0)
            {
               this.m_controller.showTip(§_-Ac§.§_-B0§,"免费送礼");
            }
            else
            {
               this.m_controller.showTip(§_-Ac§.§_-B0§,"您有新的礼物！");
            }
         }
         else if(_loc2_ == "__monthEnd__")
         {
            if(Settings.getInstance().getMonthEnds("0","month"))
            {
               this.m_controller.showTip(§_-Ac§.§_-B0§,Settings.getInstance().getMonthEnds("0","month") + "大礼包");
            }
            else
            {
               this.m_controller.showTip(§_-Ac§.§_-B0§,"大礼包");
            }
         }
         else if(_loc2_ == "__magiccard__")
         {
            this.m_controller.showTip(§_-Ac§.§_-B0§,"兑换魔法卡片礼包");
         }
         else if(_loc2_ == "__youji__")
         {
            this.m_controller.showTip(§_-Ac§.§_-B0§,"高价回收有机作物");
         }
      }
      
      public function setGiftData(param1:Object) : void
      {
         var _loc4_:Object = null;
         var _loc5_:String = null;
         this.gift = 0;
         var _loc2_:Array = [];
         var _loc3_:Array = [];
         if(param1["item"] != undefined && param1["item"] != null)
         {
            if(param1["item"] is Array)
            {
               _loc2_ = _loc2_.concat(param1["item"]);
            }
            else
            {
               _loc4_ = param1["item"];
               for(_loc5_ in _loc4_)
               {
                  _loc3_.push(_loc4_[_loc5_]);
               }
               _loc2_ = _loc2_.concat(_loc3_);
            }
         }
         if(param1.hasOwnProperty("vipItem") == true && param1["vipItem"] != undefined)
         {
            if(param1["vipItem"] is Array)
            {
               _loc2_ = _loc2_.concat(param1["vipItem"][0] != undefined ? param1["vipItem"][0] : param1["vipItem"]);
            }
            else
            {
               _loc4_ = param1["vipItem"];
               for(_loc5_ in _loc4_)
               {
                  _loc3_.push(_loc4_[_loc5_]);
               }
               _loc2_ = _loc2_.concat(_loc3_);
            }
         }
         Session.getInstance().§_-WD§(_loc2_);
      }
      
      private function showNewIconTip(param1:String, param2:Point) : void
      {
         var _loc3_:MovieClip = Utils.getMaterial("newIconTip") as MovieClip;
         _loc3_.name = "__newicontip__";
         _loc3_.tipMc.tip.text = param1;
         _loc3_.tipMc.tip.y = 17;
         _loc3_.gotoAndPlay(1);
         _loc3_.x = param2.x;
         _loc3_.y = param2.y;
         _loc3_.tipMc.bg.scaleY = -1;
         this.addChild(_loc3_);
      }
   }
}

