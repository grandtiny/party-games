package §_-Gt§
{
   import §_-0H§.Player;
   import §_-Iw§.§_-Yj§;
   import §_-VB§.§_-1B§;
   import §_-VB§.§_-2S§;
   import common.Session;
   import common.Settings;
   import common.§_-Ac§;
   import common.misc.QzoneJSAPI;
   import common.misc.Utils;
   import common.view.MoneyIcon;
   import common.view.NumAnimation;
   import flash.display.Loader;
   import flash.display.MovieClip;
   import flash.display.Sprite;
   import flash.events.Event;
   import flash.events.IOErrorEvent;
   import flash.events.MouseEvent;
   import flash.net.URLRequest;
   import flash.net.navigateToURL;
   import flash.system.LoaderContext;
   import module.uitools.widgets.profile.LevelAndExperience;
   import module.uitools.widgets.profile.NameText;
   import module.uitools.widgets.profile.PropertyText;
   import module.uitools.widgets.profile.§_-6L§;
   import module.uitools.widgets.profile.§_-E5§;
   import report.UserActionRecorder;
   
   public class §_-PB§ extends Sprite
   {
      
      private var _propertyText:PropertyText;
      
      private var _level:§_-E5§;
      
      private var _animation:NumAnimation;
      
      private var §_-St§:Number = 0;
      
      private var _rpPropertyText:PropertyText;
      
      private var §_-Of§:LevelAndExperience;
      
      private var m_controller:§_-1B§;
      
      private var _url:String;
      
      private var _nameText:NameText;
      
      private var _loader:Loader;
      
      private var §_-Ja§:Boolean;
      
      private var §_-Gc§:§_-6L§;
      
      private var _msgIcon:MovieClip;
      
      private var _exp:int;
      
      private var _fb:int;
      
      private var _goldValue:Number;
      
      private var §_-4E§:int;
      
      public function §_-PB§(param1:§_-1B§, param2:Boolean)
      {
         super();
         this._goldValue = 0;
         this._exp = 0;
         this.§_-4E§ = 0;
         this._fb = 0;
         this._url = "";
         this._loader = null;
         this.§_-Of§ = null;
         this.§_-Ja§ = param2;
         this._animation = null;
         this.m_controller = param1;
         var _loc3_:int = param2 == true ? 65 : 60;
         this.§_-Gc§ = new §_-6L§();
         this.§_-Gc§.name = "__experience__";
         this.§_-Gc§.buttonMode = true;
         this.§_-Gc§.useHandCursor = true;
         this.§_-Gc§.x = _loc3_;
         this.§_-Gc§.y = 25;
         this.§_-Gc§.percent = 0;
         if(param2 == false)
         {
            this.§_-Gc§.scaleX = 0.9;
         }
         addChild(this.§_-Gc§);
         this._level = new §_-E5§();
         this._level.name = "__level__";
         this._level.buttonMode = true;
         this._level.useHandCursor = true;
         this._level.x = this.§_-Gc§.x + this.§_-Gc§.width + 3;
         this._level.y = 15;
         this._level.level = 0;
         if(param2 == false)
         {
            this._level.scaleX = 0.95;
            this._level.scaleY = 0.95;
         }
         addChild(this._level);
         this._propertyText = new PropertyText();
         this._propertyText.x = _loc3_;
         this._propertyText.y = 40;
         addChild(this._propertyText);
         this._nameText = new NameText();
         this._nameText.x = _loc3_;
         this._nameText.y = 5;
         addChild(this._nameText);
         this._rpPropertyText = new PropertyText(MoneyIcon.§_-r§);
         this._rpPropertyText.y = 40;
         this._rpPropertyText.x = this._propertyText.width + this._propertyText.x - 10;
         addChild(this._rpPropertyText);
         if(param2 == false)
         {
            this._msgIcon = Utils.getMaterial("MsgIcon") as MovieClip;
            if(this._msgIcon != null)
            {
               this._msgIcon.name = "__msg__";
               this._msgIcon.x = this._level.x + this._level.width + 3;
               this._msgIcon.y = 20;
               this._msgIcon.scaleX = 0.8;
               this._msgIcon.scaleY = 0.8;
               this._msgIcon.mouseChildren = false;
               this._msgIcon.buttonMode = true;
               this._msgIcon.gotoAndStop(1);
               addChild(this._msgIcon);
            }
         }
         addEventListener(Event.ADDED_TO_STAGE,this.onAddedToStage,false,0,true);
         addEventListener(Event.REMOVED_FROM_STAGE,this.onRemovedFromStage,false,0,true);
      }
      
      public function get goldValue() : Number
      {
         return this._goldValue;
      }
      
      private function §_-Cx§(param1:int) : uint
      {
         return 100 * param1 * (param1 + 1);
      }
      
      public function set updateGold(param1:Number) : void
      {
         this._propertyText.goldValue = param1;
      }
      
      private function onPhotoClicked(param1:MouseEvent) : void
      {
         var _loc2_:Player = null;
         if(this.§_-Ja§ == true)
         {
            _loc2_ = Session.getInstance().host;
            UserActionRecorder.recordAction(UserActionRecorder.HF_PERSONINFO_OPEN);
         }
         else
         {
            _loc2_ = Session.getInstance().currentUser;
         }
         var _loc3_:* = {
            "index":-1,
            "player":_loc2_
         };
         this.m_controller.module.app.dispatchEvent(new §_-Yj§(§_-Ac§.§_-Bt§,_loc3_));
      }
      
      public function get exp() : int
      {
         return this._exp;
      }
      
      private function onAddedToStage(param1:Event) : void
      {
         addEventListener(MouseEvent.ROLL_OVER,this.onRollOver,true,0,true);
         addEventListener(MouseEvent.ROLL_OUT,this.onRollOut,true,0,true);
         addEventListener(MouseEvent.CLICK,this.onClick,false,0,true);
         if(this.§_-Ja§ == true && this.m_controller != null && this.m_controller.model != null)
         {
            this.m_controller.model.addEventListener(§_-2S§.§_-Ov§,this.onPlayerBaseInfoChanged);
            this.m_controller.model.addEventListener(§_-2S§.§_-1X§,this.onAccountInfoChanged);
         }
         var _loc2_:Player = null;
         if(this.§_-Ja§ == true)
         {
            _loc2_ = Session.getInstance().host;
         }
         else
         {
            _loc2_ = Session.getInstance().currentUser;
         }
         if(_loc2_ == null || _loc2_._yellowstatus == 0)
         {
            this.color = §_-E5§.§_-GX§;
         }
         else
         {
            this.color = §_-E5§.YELLOW;
            if(_loc2_ != null)
            {
               this.vip = "VipL" + _loc2_._yellowlevel;
            }
         }
      }
      
      public function set rpValue(param1:Number) : void
      {
         if(!isNaN(param1))
         {
            this.§_-St§ = param1;
            this._rpPropertyText.goldValue = param1;
         }
      }
      
      private function onRollOut(param1:MouseEvent) : void
      {
         if(param1 == null && param1.target == null)
         {
            return;
         }
         if(param1.target.name == "__vip__" || param1.target.name == "__msg__")
         {
            this.m_controller.hideTip();
         }
      }
      
      public function set exp(param1:int) : void
      {
         this._exp = param1;
         this._level.level = this.expToGrade(param1);
         var _loc2_:int = int(this.§_-Cx§(this._level.level));
         var _loc3_:int = int(this.§_-Cx§(this._level.level + 1));
         this.§_-4E§ = param1 - _loc2_;
         if(_loc3_ - _loc2_ != 0)
         {
            this.§_-Gc§.percent = (this._exp - _loc2_) / (_loc3_ - _loc2_) * 100;
         }
         this.§_-Gc§.exp = _loc3_ - _loc2_;
         this.§_-Gc§.§_-KU§ = this.§_-4E§;
      }
      
      private function expToGrade(param1:uint) : int
      {
         return Math.sqrt((param1 + 25) / 100) - 0.5;
      }
      
      private function onLeftMessageClicked(param1:MouseEvent) : void
      {
         if(this.§_-Ja§ == true)
         {
            return;
         }
         var _loc2_:Player = Session.getInstance().currentUser;
         var _loc3_:* = {
            "index":1,
            "player":_loc2_
         };
         this.m_controller.module.app.dispatchEvent(new §_-Yj§(§_-Ac§.§_-Bt§,_loc3_));
      }
      
      public function set vip(param1:String) : void
      {
         this._nameText.vip = param1;
      }
      
      public function set color(param1:String) : void
      {
         this.§_-Gc§.color = param1;
         this._level.color = param1;
      }
      
      public function get rpValue() : Number
      {
         return this.§_-St§;
      }
      
      public function set url(param1:*) : void
      {
         var _loc2_:Sprite = null;
         var _loc3_:Sprite = null;
         if(this._loader == null)
         {
            this._loader = new Loader();
            this._loader.mouseEnabled = false;
            this._loader.x = 0;
            this._loader.y = 0;
            this._loader.contentLoaderInfo.addEventListener(Event.COMPLETE,this.onPhotoLoaded);
            this._loader.contentLoaderInfo.addEventListener(IOErrorEvent.IO_ERROR,this.onPhotoLoadError);
            _loc2_ = new Sprite();
            _loc2_.x = 1;
            _loc2_.y = 8;
            _loc2_.graphics.clear();
            _loc2_.graphics.beginFill(15658734);
            _loc2_.graphics.drawRoundRect(0,0,50,50,10,10);
            _loc2_.graphics.endFill();
            addChild(_loc2_);
            _loc3_ = new Sprite();
            _loc3_.x = 1;
            _loc3_.y = 8;
            _loc3_.buttonMode = true;
            _loc3_.useHandCursor = true;
            _loc3_.graphics.clear();
            _loc3_.graphics.beginFill(15658734,1);
            _loc3_.graphics.drawRect(0,0,50,50);
            _loc3_.graphics.endFill();
            _loc3_.addEventListener(MouseEvent.CLICK,this.onPhotoClicked);
            _loc3_.mask = _loc2_;
            _loc3_.addChild(this._loader);
            addChildAt(_loc3_,0);
         }
         if(param1 != null && param1 != "")
         {
            this._loader.load(new URLRequest(param1),new LoaderContext(true));
         }
      }
      
      private function onClick(param1:MouseEvent) : void
      {
         var _loc2_:String = null;
         if(param1 == null && param1.target == null)
         {
            return;
         }
         if(param1.target.name == "__experience__" || param1.target.name == "__level__")
         {
            if(this.§_-Ja§ == false)
            {
               return;
            }
            if(this.§_-Of§ == null)
            {
               this.§_-Of§ = new LevelAndExperience();
            }
            this.m_controller.module.app.farmView.winCtrl.open(this.§_-Of§);
         }
         else if(param1.target.name == "__vip__")
         {
            return;
         }
         else if(param1.target.name == "__msg__")
         {
            this.onLeftMessageClicked(null);
         }
      }
      
      public function set userName(param1:*) : void
      {
         this._nameText.text = param1 || "农场玩家";
      }
      
      private function onPlayerBaseInfoChanged(param1:Event) : void
      {
         if(param1 == null)
         {
            return;
         }
         var _loc2_:§_-2S§ = param1.target as §_-2S§;
         if(_loc2_ == null)
         {
            return;
         }
         this.userName = _loc2_.§_-T5§.m_userName;
         this.url = _loc2_.§_-T5§.m_photoUrl;
      }
      
      public function setFriendInfo(param1:Player) : void
      {
         var _loc4_:int = 0;
         if(this.§_-Ja§ == true)
         {
            return;
         }
         if(param1 == null)
         {
            return;
         }
         if(param1._yellowstatus == 0)
         {
            this.color = §_-E5§.§_-GX§;
            this.vip = "";
         }
         else
         {
            this.color = §_-E5§.YELLOW;
            if(param1 != null)
            {
               this.vip = "VipL" + param1._yellowlevel;
            }
         }
         var _loc2_:String = param1._headPic;
         var _loc3_:int = _loc2_.lastIndexOf("/30/30");
         if(_loc2_ == "")
         {
            _loc2_ = QzoneJSAPI.getHead(param1.uin.toString(),50);
         }
         else if(_loc3_ == -1)
         {
            _loc4_ = _loc2_.lastIndexOf("/30");
            _loc2_ = _loc2_.substring(0,_loc4_) + "ht" + _loc2_.substring(_loc4_ + 3,_loc2_.length);
         }
         else
         {
            _loc2_ = _loc2_.substring(0,_loc3_) + "/50/30" + _loc2_.substring(_loc3_ + 6,_loc2_.length);
         }
         this.userName = param1._userName;
         this.url = _loc2_;
         this.goldValue = param1._money;
         this.updateGold = param1._money;
         this.exp = param1._exp;
         this.rpValue = param1._moralExp;
      }
      
      private function onPhotoLoadError(param1:IOErrorEvent) : void
      {
      }
      
      private function onRollOver(param1:MouseEvent) : void
      {
         if(param1 == null && param1.target == null)
         {
            return;
         }
         if(param1.target.name == "__vip__")
         {
            this.m_controller.showTip(§_-Ac§.§_-B0§,"已启用 VIP 7级权益");
         }
         else if(param1.target.name == "__msg__")
         {
            this.m_controller.showTip(§_-Ac§.§_-B0§,"给TA留言");
         }
      }
      
      public function set goldValue(param1:Number) : void
      {
         if(param1 < 0)
         {
            param1 = 0;
         }
         this._goldValue = param1;
      }
      
      private function onRemovedFromStage(param1:Event) : void
      {
         removeEventListener(MouseEvent.ROLL_OVER,this.onRollOver);
         removeEventListener(MouseEvent.ROLL_OUT,this.onRollOut);
         removeEventListener(MouseEvent.CLICK,this.onClick);
         if(this.§_-Ja§ == true && this.m_controller != null && this.m_controller.model != null)
         {
            this.m_controller.model.removeEventListener(§_-2S§.§_-Ov§,this.onPlayerBaseInfoChanged);
            this.m_controller.model.removeEventListener(§_-2S§.§_-1X§,this.onAccountInfoChanged);
         }
      }
      
      private function onPhotoLoaded(param1:Event) : void
      {
         this._loader.width = 50;
         this._loader.height = 50;
      }
      
      private function onAccountInfoChanged(param1:Event) : void
      {
         if(param1 == null)
         {
            return;
         }
         var _loc2_:§_-2S§ = param1.target as §_-2S§;
         if(_loc2_ == null)
         {
            return;
         }
         var _loc3_:Number = _loc2_.§_-T5§.m_gold - this.goldValue;
         if(_loc3_ != 0)
         {
            if(this._goldValue == 0)
            {
               this.goldValue = _loc2_.§_-T5§.m_gold;
               this.updateGold = _loc2_.§_-T5§.m_gold;
            }
            else
            {
               if(this._animation == null)
               {
                  this._animation = new NumAnimation(this,"updateGold",this.goldValue,_loc2_.§_-T5§.m_gold);
                  this._animation.start();
               }
               else
               {
                  this._animation.end = _loc2_.§_-T5§.m_gold;
               }
               this.goldValue = _loc2_.§_-T5§.m_gold;
               this.m_controller.openFloat(§_-Ac§.§_-Mo§,{
                  "x":100,
                  "y":60,
                  "value":_loc3_
               });
            }
         }
         _loc3_ = _loc2_.§_-T5§.m_exp - this._exp;
         if(_loc3_ != 0)
         {
            if(this._exp != 0)
            {
               this.m_controller.openFloat(§_-Ac§.§_-0f§,{
                  "x":240,
                  "y":17,
                  "value":_loc3_
               });
            }
         }
         this.exp = _loc2_.§_-T5§.m_exp;
         this.rpValue = _loc2_.§_-T5§.§_-RF§;
      }
   }
}

