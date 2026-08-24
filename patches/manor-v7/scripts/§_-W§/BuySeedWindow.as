package §_-W§
{
   import §_-0H§.Player;
   import §_-0H§.§_-I§;
   import §_-52§.§_-EU§;
   import §_-JM§.§_-3§;
   import §_-N-§.§_-2Y§;
   import §_-Oq§.StringUtil;
   import §_-Oq§.§_-Bn§;
   import §_-Oq§.§_-De§;
   import com.qzone.qui.controls.Button;
   import common.Session;
   import common.Settings;
   import common.§_-4Y§;
   import common.§_-Ac§;
   import common.§_-Yf§;
   import common.misc.QzoneJSAPI;
   import common.misc.Utils;
   import common.view.MaterialProxyBig;
   import common.view.MoneyIcon;
   import common.view.window.§_-KR§;
   import flash.display.DisplayObject;
   import flash.display.MovieClip;
   import flash.display.SimpleButton;
   import flash.display.Sprite;
   import flash.events.Event;
   import flash.events.KeyboardEvent;
   import flash.events.MouseEvent;
   import flash.events.TextEvent;
   import flash.external.ExternalInterface;
   import flash.text.TextField;
   import flash.text.TextFieldAutoSize;
   import flash.text.TextFormat;
   import flash.text.TextFormatAlign;
   import module.shop.§_-Ln§;
   
   public class BuySeedWindow extends §_-KR§
   {
      
      private var _cLevel:int;
      
      private var _green:Sprite;
      
      private var _material:MaterialProxyBig;
      
      private var _parent:§_-Ln§;
      
      private var §_-e§:Object;
      
      private var _directionText:TextField;
      
      private var money:MoneyIcon;
      
      private var _confirmButton:Button;
      
      private var _errorText:TextField;
      
      private var §_-Qf§:TextField;
      
      private var _loader2:§_-2Y§;
      
      private var _newMarkIcon:MovieClip;
      
      private var _cancelButton:Button;
      
      private var stepperSkin:DisplayObject;
      
      private var _numbericStepper:§_-EU§;
      
      private var _loader:§_-2Y§;
      
      private var §_-09§:Number;
      
      private var _vipIcon:MovieClip;
      
      private var vipRenewalButton:SimpleButton;
      
      public function BuySeedWindow(param1:§_-Ln§)
      {
         super(param1.§_-R9§.module.app as §_-3§);
         width = 400;
         height = 390;
         title = §_-4Y§.§_-Kf§["shopSeedWindow"];
         windowName = §_-Ac§.§_-WL§;
         mode = true;
         this._parent = param1;
      }
      
      private function onOK(param1:MouseEvent) : void
      {
         var _loc2_:§_-I§ = null;
         if(this._confirmButton.enabled == true)
         {
            _loc2_ = data as §_-I§;
            if(_loc2_ == null)
            {
               return;
            }
            this._parent.§_-R9§.model.§_-HJ§(_loc2_._id,this._numbericStepper.value);
            super.onClose(param1);
         }
      }
      
      override protected function setSize() : void
      {
         super.setSize();
         panelTitle.x = §_-De§.middle(_width,panelTitle.width);
      }
      
      private function onNavigateToURL(param1:TextEvent) : void
      {
      }
      
      private function onNavigateToURL2(param1:MouseEvent) : void
      {
      }
      
      private function onCancel(param1:MouseEvent) : void
      {
         super.onClose(param1);
      }
      
      private function onGotoMill(param1:MouseEvent) : void
      {
         QzoneJSAPI.toApp(376,"");
      }
      
      private function addGreenIcon() : void
      {
         var _loc1_:Sprite = new Sprite();
         _loc1_.graphics.beginFill(52224,1);
         _loc1_.graphics.drawRect(0,0,32,22);
         _loc1_.graphics.endFill();
         _loc1_.x = 113;
         _loc1_.y = 40;
         addChild(_loc1_);
         var _loc2_:TextField = new TextField();
         _loc2_.defaultTextFormat = new TextFormat("Verdana",14,16777215,true);
         _loc2_.text = "有机";
         _loc2_.selectable = false;
         _loc1_.addChild(_loc2_);
         this._green = _loc1_;
         this._green.mouseEnabled = false;
      }
      
      private function onNumChanged(param1:Event) : void
      {
         var _loc2_:§_-I§ = super.data as §_-I§;
         if(_loc2_ == null)
         {
            return;
         }
         var _loc3_:int = _loc2_._price * this._numbericStepper.value;
         if(this._cLevel >= _loc2_._lvl)
         {
            if(this.§_-09§ < _loc3_)
            {
               this._errorText.text = §_-4Y§.§_-Kf§["对不起，您的金币不足。"];
               this._confirmButton.enabled = false;
            }
            else
            {
               this._errorText.text = "";
               this._confirmButton.enabled = true;
            }
         }
         this.§_-Qf§.text = _loc3_.toString();
      }
      
      private function §_-Ws§() : String
      {
         var _loc5_:Number = NaN;
         var _loc1_:String = "";
         var _loc2_:§_-I§ = data as §_-I§;
         if(_loc2_ == null)
         {
            return _loc1_;
         }
         _loc1_ = "作物类型：" + StringUtil.getChineseNum(_loc2_._matureTime);
         var _loc3_:String = §_-Yf§.cropTime(_loc2_._id.toString());
         var _loc4_:Array = _loc3_.split(",");
         if(_loc4_ != null && _loc4_.length > 4)
         {
            _loc1_ += "季作物<br>成熟时间：<font color=\"#0099FF\">" + int(_loc4_[4] / 3600) + "</font> 小时<br>";
         }
         if(_loc2_._matureTime > 1)
         {
            _loc5_ = int((_loc4_[4] - _loc4_[2]) / 3600);
            _loc1_ += "再次成熟：<font color=\"#0099FF\">" + _loc5_ + "</font> 小时<br>";
         }
         _loc1_ += "预计产量：<font color=\"#0099FF\">" + _loc2_._output + "</font> 个";
         _loc1_ += "<br>果实售价：<font color=\"#CC3300\">金币</font><font color=\"#FF6600\">";
         if(_loc2_._high_sale > 0)
         {
            _loc1_ += _loc2_._high_sale + "<font color=\"#777777\">(原价:金币 " + _loc2_._sale + ")</font>";
         }
         else
         {
            _loc1_ += _loc2_._sale;
         }
         _loc1_ += "</font><br>预计收入：<font color=\"#CC3300\">金币</font><font color=\"#FF6600\">";
         _loc1_ += _loc2_._expect + "</font><br>收获经验：<font color=\"#0099FF\">";
         _loc1_ += _loc2_._exp + "</font> / 季<br>种植等级：<font color=\"#0099FF\">" + _loc2_._lvl + "</font> 级<br/>";
         if(_loc2_._isFood == true)
         {
            if(_loc2_._id == 3)
            {
               _loc1_ += "特殊用途：喂养动物(减少生长时间)<br/>";
            }
            else
            {
               _loc1_ += "特殊用途：喂养动物<br/>";
            }
         }
         return _loc1_;
      }
      
      override public function keyEnter(param1:KeyboardEvent) : void
      {
         this.onOK(null);
      }
      
      override protected function setData() : void
      {
         var _loc6_:String = null;
         if(super.§_-3f§ == false)
         {
            return;
         }
         var _loc1_:§_-I§ = super.data as §_-I§;
         if(_loc1_ == null)
         {
            return;
         }
         this.graphics.clear();
         var _loc2_:Player = Session.getInstance().host;
         if(_loc2_ != null)
         {
            this._cLevel = _loc2_.level;
            this.§_-09§ = _loc2_._money;
         }
         if(this.§_-e§ == null)
         {
            this.§_-e§ = Utils.getMaterial("ShopSeedForm");
            if(this.§_-e§ == null)
            {
               return;
            }
            this.§_-e§.x = 190;
            this.§_-e§.y = 40;
            addChild(this.§_-e§ as DisplayObject);
            this.§_-e§.cropTip.addEventListener(TextEvent.LINK,this.onNavigateToURL);
         }
         if(this.§_-Qf§ != null)
         {
            this.§_-Qf§.text = _loc1_._price.toString();
         }
         if(this._material != null)
         {
            this._material.setContent("1",_loc1_._id);
         }
         if(_loc1_._isNew > 0)
         {
            this._newMarkIcon.visible = true;
         }
         else
         {
            this._newMarkIcon.visible = false;
            if(_loc1_.§_-Rc§ == true)
            {
               this.addGreenIcon();
            }
            else
            {
               §_-Bn§.removeChild(this,this._green);
            }
         }
         this._numbericStepper.value = 1;
         if(this.§_-e§.cropName != undefined)
         {
            this.§_-e§.cropName.text = _loc1_._name;
            if(this.§_-e§.cropName.width < this.§_-e§.cropName.textWidth)
            {
               this.§_-e§.cropName.width = this.§_-e§.cropName.textWidth + 10;
            }
         }
         if(this.§_-e§.cropDetail != undefined)
         {
            this.§_-e§.cropDetail.width += 10;
            this.§_-e§.cropDetail.htmlText = this.§_-Ws§();
         }
         if(this.§_-e§.cropTip != undefined)
         {
            this.§_-e§.cropTip.htmlText = §_-Yf§.cropTip(_loc1_._id.toString());
         }
         var _loc3_:int = _loc1_._lvl;
         var _loc4_:int = _loc1_._price;
         var _loc5_:int = _loc4_ > 0 ? int(Math.floor(this.§_-09§ / _loc4_)) : 1;
         if(_loc5_ >= 100)
         {
            this._directionText.text = §_-4Y§.replaceText("buyNum",{
               "minNum":1,
               "maxNum":99
            });
            this._numbericStepper.maximum = 99;
         }
         else if(_loc5_ < 100 && _loc5_ >= 1)
         {
            this._directionText.text = §_-4Y§.replaceText("buyNum",{
               "minNum":1,
               "maxNum":_loc5_
            });
            this._numbericStepper.maximum = _loc5_;
         }
         else if(_loc5_ <= 1)
         {
            this._directionText.text = §_-4Y§.replaceText("buyNum",{
               "minNum":1,
               "maxNum":1
            });
            this._numbericStepper.maximum = 1;
         }
         if(this._cLevel < _loc3_)
         {
            this._confirmButton.enabled = false;
            this._errorText.text = §_-4Y§.§_-Kf§["对不起，您的等级不足。"];
         }
         else if(this.§_-09§ < _loc4_)
         {
            this._confirmButton.enabled = false;
            this._errorText.text = §_-4Y§.§_-Kf§["对不起，您的金币不足。"];
         }
         else
         {
            this._errorText.text = "";
            this._confirmButton.enabled = true;
         }
         if(!(_loc1_._isMill == 1 && _loc1_._isVip != 1))
         {
            this.§_-e§.y = 40;
            this.§_-e§.cropName.x = 0;
            this.§_-e§.cropName.y = 0;
            this.height = 390;
            this._directionText.visible = true;
            this.§_-Qf§.visible = true;
            this.money.visible = true;
            this._errorText.y = this.height - 65;
            this._confirmButton.y = height - 40;
            this._cancelButton.y = height - 40;
            title = §_-4Y§.§_-Kf§["shopSeedWindow"];
            this._confirmButton.text = §_-4Y§.§_-Kf§["确定"];
            this._confirmButton.removeEventListener(MouseEvent.CLICK,this.onGotoMill);
            this._confirmButton.addEventListener(MouseEvent.CLICK,this.onOK);
            this._confirmButton.x = width / 2 - this._confirmButton.width - 10;
            this._cancelButton.x = width / 2 + 10;
            if(this.stepperSkin != null)
            {
               this.stepperSkin.visible = true;
            }
            if(_loc1_._isVip == 1)
            {
               this._vipIcon.visible = true;
               this._confirmButton.text = "确认购买";
               title = "购买VIP专属种子";
               this._confirmButton.x += 55;
               this._cancelButton.x += 55;
               if(_loc2_._yellowstatus == 0)
               {
                  if(this.stepperSkin != null)
                  {
                     this._numbericStepper.maximum = 1;
                  }
                  this._directionText.text = §_-4Y§.replaceText("buyNum",{
                     "minNum":1,
                     "maxNum":1
                  });
                  this._errorText.text = "对不起，您不是VIP用户。";
                  this._confirmButton.enabled = false;
               }
               if(this._loader == null)
               {
                  this._loader = new §_-2Y§();
                  this._loader.y = 25;
                  this._loader.x = 1;
                  this._loader.load(Settings.getInstance().getSecondUrl("VipSeedBuyBg"));
                  addChildAt(this._loader,1);
               }
               else
               {
                  this._loader.visible = true;
               }
               if(this._loader2 == null)
               {
                  _loc6_ = _loc2_._yellowstatus != 0 ? Settings.getInstance().getSecondUrl("VipSeedButtonVip") : Settings.getInstance().getSecondUrl("VipSeedButtonNonVip");
                  this._loader2 = new §_-2Y§();
                  this._loader2.load(Utils.addPrefix(_loc6_));
               }
            }
            else
            {
               if(Boolean(this._loader) && this._loader.visible == true)
               {
                  this._loader.visible = false;
               }
               if(Boolean(this.vipRenewalButton) && this.vipRenewalButton.visible == true)
               {
                  this.vipRenewalButton.visible = false;
               }
               if(this._vipIcon.visible == true)
               {
                  this._vipIcon.visible = false;
               }
            }
         }
         this.setSize();
      }
      
      override protected function addedToLayer() : void
      {
         super.addedToLayer();
         this._material = new MaterialProxyBig();
         this._material.x = 25;
         this._material.y = 40;
         addChild(this._material);
         this.money = new MoneyIcon();
         addChild(this.money);
         this.money.x = 40;
         this.money.y = 170;
         this.§_-Qf§ = new TextField();
         this.§_-Qf§.selectable = false;
         this.§_-Qf§.defaultTextFormat = new TextFormat("Verdana",11,16737792,true);
         this.§_-Qf§.text = "0";
         this.§_-Qf§.width = 100;
         this.§_-Qf§.height = 22;
         addChild(this.§_-Qf§);
         this.§_-Qf§.x = 70;
         this.§_-Qf§.y = 170;
         this._numbericStepper = new §_-EU§();
         this._numbericStepper.maximum = 99;
         this._numbericStepper.minimum = 1;
         this._numbericStepper.value = 1;
         this._numbericStepper.addEventListener(Event.CHANGE,this.onNumChanged);
         this.stepperSkin = Utils.getMaterial("SteperSkin") as DisplayObject;
         if(this.stepperSkin != null)
         {
            this.stepperSkin.x = 30;
            this.stepperSkin.y = 200;
            this._numbericStepper.setSkin(this.stepperSkin as Sprite);
            addChild(this.stepperSkin);
         }
         this._directionText = new TextField();
         this._directionText.mouseEnabled = false;
         this._directionText.selectable = false;
         this._directionText.x = 25;
         this._directionText.y = 225;
         this._directionText.autoSize = TextFieldAutoSize.LEFT;
         this._directionText.defaultTextFormat = new TextFormat("Verdana",12,3355443);
         this._directionText.text = §_-4Y§.replaceText("buyNum",{
            "minNum":1,
            "maxNum":99
         });
         addChild(this._directionText);
         this._errorText = new TextField();
         this._errorText.mouseEnabled = false;
         this._errorText.selectable = false;
         this._errorText.x = 0;
         this._errorText.y = this.height - 65;
         this._errorText.width = 400;
         this._errorText.height = 21;
         this._errorText.defaultTextFormat = new TextFormat("Verdana",12,13369344,null,null,null,null,null,TextFormatAlign.CENTER);
         this._errorText.text = "";
         addChild(this._errorText);
         this._confirmButton = new Button();
         this._confirmButton.defaultSkin = Utils.getClass("ButtonOrange");
         this._confirmButton.width = 64;
         this._confirmButton.height = 25;
         this._confirmButton.x = width / 2 - this._confirmButton.width - 10;
         this._confirmButton.y = height - 40;
         this._confirmButton.text = §_-4Y§.§_-Kf§["确定"];
         this._confirmButton.addEventListener(MouseEvent.CLICK,this.onOK);
         addChild(this._confirmButton);
         this._cancelButton = new Button();
         this._cancelButton.defaultSkin = Utils.getClass("ButtonBlue");
         this._cancelButton.width = 64;
         this._cancelButton.height = 25;
         this._cancelButton.x = width / 2 + 10;
         this._cancelButton.y = height - 40;
         this._cancelButton.text = §_-4Y§.§_-Kf§["取消"];
         this._cancelButton.addEventListener(MouseEvent.CLICK,this.onCancel);
         addChild(this._cancelButton);
         this._vipIcon = Utils.getMaterial("VipSeedIcon") as MovieClip;
         this._vipIcon.x = this._material.x + 2;
         this._vipIcon.y = this._material.y + 1;
         this._vipIcon.visible = false;
         addChild(this._vipIcon);
         this._newMarkIcon = Utils.getMaterial("ShopNewMarkIcon") as MovieClip;
         this._newMarkIcon.x = 85;
         this._newMarkIcon.y = 40;
         addChild(this._newMarkIcon);
      }
   }
}

