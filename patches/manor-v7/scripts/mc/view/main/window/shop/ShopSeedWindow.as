package mc.view.main.window.shop
{
   import com.minutes.ui.control.LipiButton;
   import com.minutes.ui.control.NumbericStepper;
   import com.minutes.ui.core.LipiSkin;
   import com.minutes.ui.core.UIEvent;
   import com.qzone.qfa.managers.LoadManager;
   import com.qzone.qfa.managers.events.LoaderEvent;
   import common.MaterialLib;
   import flash.display.Bitmap;
   import flash.display.DisplayObject;
   import flash.display.Loader;
   import flash.display.Sprite;
   import flash.events.Event;
   import flash.events.MouseEvent;
   import flash.events.TextEvent;
   import flash.external.ExternalInterface;
   import flash.media.Sound;
   import flash.media.SoundChannel;
   import flash.net.URLRequest;
   import flash.net.navigateToURL;
   import flash.text.TextField;
   import flash.text.TextFieldAutoSize;
   import flash.text.TextFormat;
   import flash.text.TextFormatAlign;
   import mc.control.Command;
   import mc.control.ViewControl;
   import mc.events.WindowEvent;
   import mc.model.MData;
   import mc.model.MainData;
   import mc.view.common.BaseWindow;
   import mc.view.common.Language;
   import mc.view.common.MoneyIcon;
   import mc.view.farm.GetCropID;
   import mc.view.main.WindowControl.WControl;
   import mc.view.main.tip.TipControl;
   
   public class ShopSeedWindow extends BaseWindow
   {
      
      private var buyTipText:TextField;
      
      private var sound2:Sound;
      
      private var sound1:Sound;
      
      private var confirmButton:LipiButton;
      
      private var sFeedTxt2:TextField = new TextField();
      
      private var cropPrice:TextField;
      
      private var sFeedTxt1:TextField = new TextField();
      
      private var numbericStepper:NumbericStepper;
      
      private var vipButton:Sprite;
      
      private var userMoney:int = 0;
      
      private var isinit:Boolean = false;
      
      private var _vipBg:Sprite;
      
      private var _shopSeedForm:Object;
      
      private var directionText:TextField;

      private var detailLabels:TextField;

      private var detailSuffixes:TextField;
      
      private var levelText:TextField;
      
      private var errorText:ErrorText;
      
      private var _loadManger:LoadManager;
      
      private var cLevel:int = 99;
      
      private var tipText:TextField;
      
      private var sc:SoundChannel;
      
      public function ShopSeedWindow()
      {
         super();
         width = 510;
         height = 420;
         titleIMG = MaterialLib.getInstance().getClass("ShopSeedWindowTitle");
         windowName = "ShopSeedWindow";
         mode = true;
      }
      
      override public function init() : void
      {
         var _loc3_:LipiButton = null;
         var _loc4_:MainData = null;
         var _loc5_:Bitmap = null;
         this.isinit = true;
         var _loc1_:MoneyIcon = new MoneyIcon();
         addChild(_loc1_);
         this.cropPrice = new TextField();
         this.cropPrice.selectable = false;
         this.cropPrice.defaultTextFormat = new TextFormat("_sans",11,16737792,true);
         this.cropPrice.text = "300";
         this.cropPrice.width = 100;
         this.cropPrice.height = 22;
         addChild(this.cropPrice);
         _loc1_.x = 67;
         _loc1_.y = 155;
         this.cropPrice.x = 95;
         this.cropPrice.y = 155;
         this.numbericStepper = new NumbericStepper();
         this.numbericStepper.max_num = 99;
         this.numbericStepper.x = 55;
         this.numbericStepper.y = 185;
         this.numbericStepper.addEventListener(UIEvent.TEXT_CHANGE,this.numChange);
         addChild(this.numbericStepper);
         this.directionText = new TextField();
         this.directionText.mouseEnabled = false;
         this.directionText.selectable = false;
         this.directionText.x = 15;
         this.directionText.y = 213;
         this.directionText.width = 180;
         this.directionText.autoSize = TextFieldAutoSize.CENTER;
         this.directionText.defaultTextFormat = new TextFormat("_sans",12,8999699);
         this.directionText.text = Language.replaceText("buyNum",{
            "minNum":1,
            "maxNum":99
         });
         addChild(this.directionText);
         this.tipText = new TextField();
         this.tipText.width = 460;
         this.tipText.wordWrap = true;
         this.tipText.multiline = true;
         this.tipText.autoSize = TextFieldAutoSize.LEFT;
         this.tipText.x = (this.width - this.tipText.width) / 2;
         this.tipText.selectable = false;
         this.tipText.mouseWheelEnabled = false;
         addChild(this.tipText);
         this.tipText.y = 300;
         this.buyTipText = new TextField();
         this.buyTipText.wordWrap = false;
         this.buyTipText.multiline = false;
         this.buyTipText.autoSize = TextFieldAutoSize.CENTER;
         this.buyTipText.selectable = false;
         this.buyTipText.mouseWheelEnabled = false;
         this.buyTipText.defaultTextFormat = new TextFormat("_sans",12,16737792);
         this.buyTipText.x = 15;
         this.buyTipText.y = 235;
         this.buyTipText.width = 180;
         addChild(this.buyTipText);
         this.levelText = new TextField();
         this.levelText.wordWrap = false;
         this.levelText.multiline = false;
         this.levelText.autoSize = TextFieldAutoSize.LEFT;
         this.levelText.selectable = false;
         this.levelText.mouseWheelEnabled = false;
         this.levelText.defaultTextFormat = new TextFormat("_sans",12,16737792);
         this.errorText = new ErrorText(false);
         this.errorText.visible = false;
         this.errorText.y = 212;
         addChild(this.errorText);
         var _loc2_:Sprite = this.createDashedLine(16103542,466,2,2,4);
         addChild(_loc2_);
         _loc2_.x = (this.width - _loc2_.width) / 2;
         _loc2_.y = 290;
         if(data["isvip"])
         {
            _loc1_.y = 200;
            this.cropPrice.y = 200;
            this.numbericStepper.y = 230;
            this.directionText.y = 255;
            this.errorText.y = 262;
            this.buyTipText.y = 270;
            this._vipBg = new Sprite();
            this._vipBg.x = 10;
            this._vipBg.y = 35;
            addChildAt(this._vipBg,0);
            this._loadManger = new LoadManager();
            this._loadManger.add(GetCropID.getVipAnimalURL("VipSeedBuyBg.jpg"));
            this._loadManger.addEventListener(LoaderEvent.COMPLETE,this.completeHandler);
            this._loadManger.start();
            _loc4_ = MData.getInstance().mainData;
            this.confirmButton = new LipiButton();
            this.confirmButton.bgAlpha = 0;
            this.confirmButton.bgSkin = new LipiSkin(MaterialLib.getInstance().getClass("ButtonOrange"));
            this.confirmButton.width = 88;
            this.confirmButton.height = 25;
            this.confirmButton.x = width / 2 - this.confirmButton.width / 2;
            this.confirmButton.y = height - 45;
            this.confirmButton.label = "确认购买";
            this.confirmButton.textColor = 16777215;
            this.confirmButton.addEventListener(MouseEvent.CLICK,this.confirmButtonClick);
            addChild(this.confirmButton);
            _loc3_ = new LipiButton();
            _loc3_.bgAlpha = 0;
            _loc3_.bgSkin = new LipiSkin(MaterialLib.getInstance().getClass("ButtonBlue"));
            _loc3_.width = 64;
            _loc3_.height = 25;
            _loc3_.x = this.confirmButton.x + this.confirmButton.width + 10;
            _loc3_.y = height - 45;
            _loc3_.label = "取消";
            _loc3_.textColor = 16777215;
            _loc3_.addEventListener(MouseEvent.CLICK,this.cancelButtonClick);
            addChild(_loc3_);
            if(_loc4_.host["yellowstatus"] < 1)
            {
               this.errorText.text = "对不起，您不是VIP用户！";
               this.errorText.x = Math.floor(this.width - this.errorText.width) / 2 - 145;
               this.directionText.visible = false;
               this.buyTipText.visible = false;
               this.canNotBuy();
            }
         }
         else
         {
            this.confirmButton = new LipiButton();
            this.confirmButton.bgAlpha = 0;
            this.confirmButton.bgSkin = new LipiSkin(MaterialLib.getInstance().getClass("ButtonOrange"));
            this.confirmButton.width = 64;
            this.confirmButton.height = 25;
            this.confirmButton.x = width / 2 - this.confirmButton.width - 10;
            this.confirmButton.y = height - 45;
            this.confirmButton.label = "确定";
            this.confirmButton.textColor = 16777215;
            this.confirmButton.addEventListener(MouseEvent.CLICK,this.confirmButtonClick);
            addChild(this.confirmButton);
            _loc3_ = new LipiButton();
            _loc3_.bgAlpha = 0;
            _loc3_.bgSkin = new LipiSkin(MaterialLib.getInstance().getClass("ButtonBlue"));
            _loc3_.width = 64;
            _loc3_.height = 25;
            _loc3_.x = width / 2 + 10;
            _loc3_.y = height - 45;
            _loc3_.label = "取消";
            _loc3_.textColor = 16777215;
            _loc3_.addEventListener(MouseEvent.CLICK,this.cancelButtonClick);
            addChild(_loc3_);
         }
         this.setData();
      }
      
      private function onLoadCompete(param1:Event) : void
      {
      }
      
      private function confirmButtonClick(param1:MouseEvent = null) : void
      {
         if(this.confirmButton.enable == true)
         {
            Command.getInstance().mainCommand.buySeed(data["cId"],this.numbericStepper.get_num);
            WControl.close(this);
         }
      }
      
      private function cancelButtonClick(param1:MouseEvent) : void
      {
         var _loc2_:WindowEvent = new WindowEvent(WindowEvent.CLOSE);
         _loc2_.window = this;
         ViewControl.getInstance().dispatchEvent(_loc2_);
      }
      
      private function canNotBuy() : void
      {
         this.cropPrice.text = "0";
         this.numbericStepper.disable(true,2);
         this.numbericStepper.get_num = 0;
         this.confirmButton.enable = false;
      }
      
      private function vipButtonClick(param1:MouseEvent = null) : void
      {
      }
      
      private function setData() : void
      {
         var _loc2_:String = null;
         var _loc8_:String = null;
         var _loc9_:Loader = null;
         var _loc16_:String = null;
         var _loc17_:ErrorText = null;
         var _loc18_:ErrorText = null;
         var _loc19_:Bitmap = null;
         var _loc20_:Sprite = null;
         var _loc21_:Sprite = null;
         var _loc1_:Object = data;
         if(_loc1_ == null)
         {
            return;
         }
         if(this.isinit == false)
         {
            return;
         }
         if(this._shopSeedForm == null)
         {
            _loc16_ = "";
            this._shopSeedForm = MaterialLib.getInstance().getMaterial("ShopSeedForm") as Object;
            this._shopSeedForm.x = 225;
            this._shopSeedForm.y = 50;
            this._shopSeedForm.getChildAt(0).visible = false;
            this._shopSeedForm.getChildAt(1).visible = false;
            this._shopSeedForm.getChildAt(2).visible = false;
            this._shopSeedForm.getChildAt(8).visible = false;
            if(this._shopSeedForm["level"] != undefined)
            {
               this.levelText.x = this._shopSeedForm["level"].x;
               this.levelText.y = this._shopSeedForm["level"].y;
               this.levelText.width = this._shopSeedForm["level"].width;
               this._shopSeedForm.removeChild(this._shopSeedForm["level"] as DisplayObject);
               this._shopSeedForm.addChild(this.levelText);
            }
            addChild(this._shopSeedForm as DisplayObject);
            this.detailLabels = new TextField();
            this.detailLabels.defaultTextFormat = new TextFormat("Verdana",12,0x895313,null,null,null,null,null,TextFormatAlign.RIGHT,null,null,null,10);
            this.detailLabels.mouseEnabled = false;
            this.detailLabels.selectable = false;
            this.detailLabels.multiline = true;
            this.detailLabels.x = 185;
            this.detailLabels.y = 86;
            this.detailLabels.width = 110;
            this.detailLabels.height = 190;
            this.detailLabels.text = "成长时间：\n生产时间：\n预计产量：\n产物价值：\n动物价值：\n领养等级：\n居住地：";
            addChild(this.detailLabels);
            this.detailSuffixes = new TextField();
            this.detailSuffixes.defaultTextFormat = new TextFormat("Verdana",12,0x895313,null,null,null,null,null,TextFormatAlign.LEFT,null,null,null,10);
            this.detailSuffixes.mouseEnabled = false;
            this.detailSuffixes.selectable = false;
            this.detailSuffixes.multiline = true;
            this.detailSuffixes.x = 315;
            this.detailSuffixes.y = 86;
            this.detailSuffixes.width = 180;
            this.detailSuffixes.height = 70;
            addChild(this.detailSuffixes);
         }
         this.initBuyNumber();
         var _loc3_:int = int(MData.getInstance().mainData.getHostId);
         if(_loc1_["cId"] == 1028 || _loc1_["cId"] == 1029)
         {
            if(_loc1_["cId"] == 1029 && _loc3_ % 2 == 1 || _loc1_["cId"] == 1028 && _loc3_ % 2 == 0)
            {
               _loc2_ = "七夕活动动物随机派送购买资格，您无法购买当前动物哦！";
               this.confirmButton.enable = false;
            }
            else
            {
               _loc2_ = "七夕活动动物随机派送购买资格，您可以购买当前动物！";
               this.confirmButton.enable = true;
            }
            _loc17_ = new ErrorText();
            _loc17_.text = _loc2_;
            _loc17_.y = 340;
            _loc17_.x = this.width / 2 - _loc17_.width / 2;
            addChild(_loc17_);
         }
         var _loc4_:String = "";
         var _loc5_:Array = [1,2,3,4,5];
         var _loc6_:Array = [6,7,8,9,0];
         var _loc7_:Number = Number(_loc3_.toString().substr(-1,1));
         if(_loc1_["cId"] == 1032 || _loc1_["cId"] == 1033)
         {
            if(_loc1_["cId"] == 1032 && _loc5_.indexOf(_loc7_) == -1 || _loc1_["cId"] == 1033 && _loc6_.indexOf(_loc7_) == -1)
            {
               _loc4_ = "中秋国庆活动动物随机派送购买资格，您无法购买当前动物哦！";
               this.confirmButton.enable = false;
            }
            else
            {
               _loc4_ = "中秋国庆活动动物随机派送购买资格，您可以购买当前动物！";
               this.confirmButton.enable = true;
            }
            _loc18_ = new ErrorText();
            _loc18_.text = _loc4_;
            _loc18_.y = 340;
            _loc18_.x = this.width / 2 - _loc18_.width / 2;
            addChild(_loc18_);
         }
         this._shopSeedForm.time.defaultTextFormat = new TextFormat("Verdana",12,0x3A9663);
         this._shopSeedForm.time2.defaultTextFormat = new TextFormat("Verdana",12,0x3A9663);
         this._shopSeedForm.amount.defaultTextFormat = new TextFormat("Verdana",12,0x3A9663);
         this._shopSeedForm.price.defaultTextFormat = new TextFormat("Verdana",12,0xFF6600);
         this._shopSeedForm.productPrice.defaultTextFormat = new TextFormat("Verdana",12,0xFF6600);
         this._shopSeedForm.house.defaultTextFormat = new TextFormat("Verdana",12,0xFF6600);
         this.levelText.defaultTextFormat = new TextFormat("Verdana",12,0xFF6600);
         this._shopSeedForm.time2.text = _loc1_["procreation"] / 3600;
         this._shopSeedForm.time.text = _loc1_["maturingTime"] / 3600;
         this.detailSuffixes.text = "小时（每4小时吃" + int(_loc1_["consum"]) + "粒饲料）\n小时（间隔" + int(_loc1_["cycle"]) / 3600 + "小时）";
         if(data["isvip"])
         {
            _loc8_ = GetCropID.getShopIconUrl(_loc1_["cId"],false,true);
            _loc9_ = new Loader();
            _loc9_.addEventListener(Event.COMPLETE,this.onLoadCompete);
            _loc9_.load(new URLRequest(_loc8_));
            addChild(_loc9_);
            _loc9_.x = 50;
            _loc9_.y = 75;
            _loc19_ = new Bitmap(MData.getInstance().mainData.vipIcon.bitmapData);
            addChild(_loc19_);
            _loc19_.x = _loc9_.x;
            _loc19_.y = _loc9_.y;
         }
         else
         {
            _loc8_ = GetCropID.getShopIconUrl(_loc1_["cId"],true);
            _loc9_ = new Loader();
            _loc9_.addEventListener(Event.COMPLETE,this.onLoadCompete);
            _loc9_.load(new URLRequest(_loc8_));
            addChild(_loc9_);
            _loc9_.x = 20;
            _loc9_.y = 45;
         }
         if(_loc1_.hasOwnProperty("bsprice") && int(_loc1_["bsprice"]) > 0)
         {
            this._shopSeedForm.price.width += 120;
            this._shopSeedForm.price.htmlText = _loc1_["bsprice"] + "金币" + "<font color = \'#895313\'>（原价：金币" + _loc1_["byproductprice"] + "）</font>";
         }
         else
         {
            this._shopSeedForm.price.text = _loc1_["byproductprice"] + "金币";
         }
         this._shopSeedForm.cropName.text = _loc1_["cName"];
         this._shopSeedForm.cropName.width = 180;
         this._shopSeedForm.amount.text = int(_loc1_["output"]) + " 个";
         this._shopSeedForm.consum.text = "";
         this._shopSeedForm.cycle.text = "";
         if(_loc1_.hasOwnProperty("msprice") && int(_loc1_["msprice"]) > 0)
         {
            this._shopSeedForm.productPrice.width += 120;
            this._shopSeedForm.productPrice.htmlText = _loc1_["msprice"] + "金币" + "<font color = \'#895313\'>（原价：金币" + _loc1_["productprice"] + "）</font>";
         }
         else
         {
            this._shopSeedForm.productPrice.text = int(_loc1_["productprice"]) + "金币";
         }
         if(int(_loc1_["cType"]) == 4)
         {
            this._shopSeedForm.productPrice.text += "×" + int(_loc1_["expect"]) + "份";
            this._shopSeedForm.productPrice.width += 40;
         }
         this.levelText.text = _loc1_["cLevel"] + " 级";
         this._shopSeedForm.house.text = GetCropID.getHouse(_loc1_["cId"]);
         var _loc10_:String = "小贴士：" + GetCropID.getTipInfo(_loc1_["cId"]);
         var _loc11_:TextFormat = new TextFormat();
         _loc11_.leading = 4;
         _loc11_.color = 8999699;
         this.tipText.htmlText = _loc10_;
         this.tipText.setTextFormat(_loc11_);
         this.tipText.addEventListener(TextEvent.LINK,this.linkHandler);
         if(GetCropID.idToSound(_loc1_["cId"]) == 1)
         {
            _loc20_ = MaterialLib.getInstance().getMaterial("SoundIcon") as Sprite;
            addChild(_loc20_);
            _loc20_.x = 390;
            _loc20_.y = 65;
            _loc20_.buttonMode = true;
            _loc20_.addEventListener(MouseEvent.CLICK,this.onSoundClick);
            _loc20_.addEventListener(MouseEvent.ROLL_OVER,this.onRollOver);
            _loc20_.addEventListener(MouseEvent.ROLL_OUT,this.onRollOut);
         }
         this.sFeedTxt1.x = 233;
         this.sFeedTxt1.y = 264;
         this.sFeedTxt1.selectable = false;
         this.sFeedTxt1.autoSize = TextFieldAutoSize.LEFT;
         this.sFeedTxt1.defaultTextFormat = new TextFormat("Verdana",12,8999699);
         addChild(this.sFeedTxt1);
         if(_loc1_["sinfo"] != "")
         {
            this.sFeedTxt1.text = "特别说明：" + _loc1_["sinfo"];
         }
         else
         {
            this.sFeedTxt1.text = "";
         }
         var _loc12_:RegExp = /<a href.*?><u>/i;
         var _loc13_:int = 0;
         var _loc14_:Array = this.tipText.htmlText.match(_loc12_);
         if(_loc14_)
         {
            _loc13_ = (_loc14_[0] as String).length;
         }
         var _loc15_:Number = _loc10_.indexOf("    ");
         if(_loc15_ != -1)
         {
            _loc21_ = MaterialLib.getInstance().getMaterial("SoundIcon2") as Sprite;
            addChild(_loc21_);
            _loc21_.x = this.tipText.getCharBoundaries(_loc15_ - _loc13_).x + 27;
            _loc21_.y = this.tipText.y + 5;
            _loc21_.buttonMode = true;
            _loc21_.addEventListener(MouseEvent.CLICK,this.onSoundClick2);
            _loc21_.addEventListener(MouseEvent.ROLL_OVER,this.onRollOver2);
            _loc21_.addEventListener(MouseEvent.ROLL_OUT,this.onRollOut);
         }
      }
      
      private function onRollOut(param1:MouseEvent) : void
      {
         TipControl.hide();
      }
      
      private function onSoundClick2(param1:MouseEvent) : void
      {
         var _loc2_:String = null;
         var _loc3_:Loader = null;
         if(MaterialLib.getInstance().getClass("Sound_2_" + data["cId"]) == null)
         {
            _loc2_ = GetCropID.getSwfUrl() + "main/sound/animal/2/s" + data["cId"] + ".swf";
            _loc3_ = new Loader();
            _loc3_.contentLoaderInfo.addEventListener(Event.COMPLETE,this.playSound2);
            _loc3_.load(new URLRequest(_loc2_));
            return;
         }
         this.playSound2();
      }
      
      private function playSound(param1:Event = null) : void
      {
         var _loc2_:String = null;
         if(param1)
         {
            MaterialLib.getInstance().push(param1.currentTarget.applicationDomain);
         }
         if(!this.sound1)
         {
            _loc2_ = "Sound_1_" + data["cId"];
            this.sound1 = MaterialLib.getInstance().getMaterial(_loc2_) as Sound;
         }
         if(this.sc)
         {
            this.sc.stop();
         }
         this.sc = this.sound1.play();
      }
      
      private function initBuyNumber() : void
      {
         var _loc1_:Object = MData.getInstance().mainData;
         var _loc2_:Object = _loc1_.host;
         var _loc3_:int = int(_loc1_.expToGrade(_loc2_["exp"]));
         if(this.errorText.text == "")
         {
            if(_loc3_ < int(data["cLevel"]))
            {
               this.errorText.text = "对不起，您的等级不足。";
               this.errorText.visible = true;
               this.errorText.x = Math.floor(this.width - this.errorText.width) / 2 - 145;
               this.directionText.visible = false;
               this.canNotBuy();
               return;
            }
         }
         this.userMoney = parseInt(_loc2_["money"]);
         var _loc4_:int = parseInt(data["price"]);
         if(_loc4_ <= 0)
         {
            this.canNotBuy();
            return;
         }
         var _loc5_:int = Math.floor(this.userMoney / _loc4_);
         var _loc6_:int = 0;
         if(GetCropID.getHouse(data["cId"]) == "窝")
         {
            _loc6_ = int(_loc1_.getAnimalNum(_loc2_["house1"],"窝"));
            _loc6_ = _loc6_ - _loc2_["animal1"];
         }
         else if(_loc2_["house2"] == 0)
         {
            _loc6_ = 0;
         }
         else
         {
            _loc6_ = int(_loc1_.getAnimalNum(_loc2_["house2"],"棚"));
            _loc6_ = _loc6_ - _loc2_["animal2"];
         }
         if(this.errorText.text == "")
         {
            if(_loc5_ >= 1 && _loc6_ >= 1)
            {
               if(_loc5_ < _loc6_)
               {
                  this.numbericStepper.get_num = _loc5_;
                  this.numbericStepper.max_num = _loc5_;
                  this.buyTipText.text = "当前金币最多可买" + _loc5_ + "只";
                  this.buyTipText.visible = true;
                  if(_loc5_ == 1)
                  {
                     this.directionText.visible = false;
                     this.buyTipText.y = this.directionText.y;
                  }
                  else
                  {
                     this.directionText.visible = true;
                     this.directionText.text = Language.replaceText("buyNum",{
                        "minNum":1,
                        "maxNum":_loc5_
                     });
                     if(data["isvip"])
                     {
                        this.buyTipText.y = 270;
                     }
                     else
                     {
                        this.buyTipText.y = 235;
                     }
                  }
               }
               else
               {
                  this.numbericStepper.get_num = _loc6_;
                  this.numbericStepper.max_num = _loc6_;
                  if(_loc6_ == 1)
                  {
                     this.directionText.visible = false;
                     this.buyTipText.y = this.directionText.y;
                  }
                  else
                  {
                     this.directionText.text = Language.replaceText("buyNum",{
                        "minNum":1,
                        "maxNum":_loc6_
                     });
                     this.directionText.visible = true;
                     if(data["isvip"])
                     {
                        this.buyTipText.y = 270;
                     }
                     else
                     {
                        this.buyTipText.y = 235;
                     }
                  }
                  if(GetCropID.getHouse(data["cId"]) == "窝")
                  {
                     this.buyTipText.text = "当前窝最多可住" + _loc6_ + "只";
                  }
                  else
                  {
                     this.buyTipText.text = "当前棚最多可住" + _loc6_ + "只";
                  }
                  this.buyTipText.visible = true;
               }
               this.confirmButton.enable = true;
               if(this.numbericStepper.get_num > 1)
               {
                  this.numbericStepper.disable(true,1);
                  this.numbericStepper.disable(false,0);
               }
               else if(this.numbericStepper.get_num == 1)
               {
                  this.numbericStepper.disable(true,0);
                  this.numbericStepper.disable(true,1);
               }
               else
               {
                  this.numbericStepper.disable(true,0);
                  this.numbericStepper.disable(false,1);
               }
            }
            else
            {
               this.directionText.visible = false;
               this.buyTipText.visible = false;
               if(_loc5_ < 1)
               {
                  this.errorText.text = "您的金币不足";
                  this.errorText.x = Math.floor(this.width - this.errorText.width) / 2 - 145;
                  this.canNotBuy();
                  return;
               }
               if(_loc6_ < 1)
               {
                  if(GetCropID.getHouse(data["cId"]) == "窝")
                  {
                     this.errorText.text = "您的窝已住满";
                  }
                  else
                  {
                     this.errorText.text = "您的棚已住满";
                  }
                  this.errorText.x = Math.floor(this.width - this.errorText.width) / 2 - 157;
                  this.canNotBuy();
                  return;
               }
            }
         }
      }
      
      override public function keyEnter() : void
      {
         this.confirmButtonClick();
      }
      
      private function onRollOver2(param1:MouseEvent) : void
      {
         TipControl.show("MouseTip","播放英文读音");
      }
      
      override public function set data(param1:Object) : void
      {
         super.data = param1;
         this.setData();
      }
      
      private function numChange(param1:UIEvent = null) : void
      {
         var _loc2_:int = data["price"] * this.numbericStepper.get_num;
         this.cropPrice.text = String(_loc2_);
      }
      
      private function playSound2(param1:Event = null) : void
      {
         var _loc2_:String = null;
         if(param1)
         {
            MaterialLib.getInstance().push(param1.currentTarget.applicationDomain);
         }
         if(!this.sound2)
         {
            _loc2_ = "Sound_2_" + data["cId"];
            this.sound2 = MaterialLib.getInstance().getMaterial(_loc2_) as Sound;
         }
         if(this.sc)
         {
            this.sc.stop();
         }
         this.sc = this.sound2.play();
      }
      
      private function completeHandler(param1:LoaderEvent) : void
      {
         if(param1.type == LoaderEvent.COMPLETE)
         {
            this._vipBg.addChild(param1.item.data as Bitmap);
         }
      }
      
      private function createDashedLine(param1:Number, param2:Number, param3:Number, param4:Number, param5:Number) : Sprite
      {
         var _loc6_:Sprite = new Sprite();
         var _loc7_:Number = 0;
         var _loc8_:Number = Math.floor(param2 / (param4 + param5));
         var _loc9_:Number = 0;
         while(_loc9_ < _loc8_)
         {
            _loc6_.graphics.lineStyle(param3,param1,1);
            _loc6_.graphics.moveTo(_loc9_ * (param4 + param5),0);
            _loc6_.graphics.lineTo(_loc9_ * (param4 + param5) + param4,0);
            _loc9_++;
         }
         return _loc6_;
      }
      
      private function onRollOver(param1:MouseEvent) : void
      {
         TipControl.show("MouseTip","播放动物声音");
      }
      
      private function onSoundClick(param1:MouseEvent) : void
      {
         var _loc2_:String = null;
         var _loc3_:Loader = null;
         if(MaterialLib.getInstance().getClass("Sound_1_" + data["cId"]) == null)
         {
            _loc2_ = GetCropID.getSwfUrl() + "main/sound/animal/1/s" + data["cId"] + ".swf";
            _loc3_ = new Loader();
            _loc3_.contentLoaderInfo.addEventListener(Event.COMPLETE,this.playSound);
            _loc3_.load(new URLRequest(_loc2_));
            return;
         }
         this.playSound();
      }
      
      private function linkHandler(param1:TextEvent) : void
      {
         ExternalInterface.call("window.open",param1.text);
      }
   }
}

