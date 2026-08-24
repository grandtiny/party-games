package mc.view.main.window.shop
{
   import com.minutes.ui.control.LipiButton;
   import com.minutes.ui.control.NumbericStepper;
   import com.minutes.ui.core.LipiSkin;
   import com.minutes.ui.core.UIEvent;
   import com.qzone.qui.controls.RadioButton;
   import com.qzone.qui.makers.RadioGroup;
   import common.LocalData;
   import common.MaterialLib;
   import flash.display.*;
   import flash.events.Event;
   import flash.events.MouseEvent;
   import flash.events.TextEvent;
   import flash.external.ExternalInterface;
   import flash.net.URLRequest;
   import flash.text.TextField;
   import flash.text.TextFieldAutoSize;
   import flash.text.TextFormat;
   import flash.text.TextFormatAlign;
   import mc.FBridge.EventRecorder;
   import mc.control.Command;
   import mc.control.TinItemCommand;
   import mc.control.ViewControl;
   import mc.events.WindowEvent;
   import mc.model.MData;
   import mc.model.MainData;
   import mc.view.common.AlertWindow;
   import mc.view.common.BaseWindow;
   import mc.view.common.ConfirmWindow;
   import mc.view.common.Language;
   import mc.view.common.MaterialProxyBig;
   import mc.view.common.WildMaterialLoaderProxy;
   import mc.view.farm.GetCropID;
   import mc.view.main.WindowControl.WControl;
   import wild.com.Shell.model.TipText.StaticTextTip;
   
   public class ShopTinWindow extends BaseWindow
   {
      
      private var qdBuyButton:LipiButton;
      
      private var materialProxy:*;
      
      private var _specialDogPrice:TextField;
      
      private var titleText:TextField;
      
      private var _dogTipText:TextField;
      
      private var numbericStepper:NumbericStepper;
      
      private var rbtnBuy1:RadioButton;
      
      private var rbtnBuy2:RadioButton;
      
      private var rbtnBuy3:RadioButton;
      
      private var userMoney:int;
      
      private var contentText:TextField;
      
      private var userFB:int;
      
      private var cancelButton:LipiButton;
      
      private var cftBuybutton:LipiButton;
      
      private var tipSprite:Sprite;
      
      private var directionText:TextField;
      
      private var errorText:ErrorText;
      
      private var radioGroupDog:RadioGroup;
      
      private var alertWin:AlertWindow;
      
      private var tipText:TextField;
      
      private var textDefaultFormat:TextFormat;
      
      private var confirmWin:ConfirmWindow;
      
      public function ShopTinWindow()
      {
         super();
         width = 445;
         height = 328;
         this.userMoney = 0;
         this.userFB = 10000;
         titleIMG = MaterialLib.getInstance().getClass("BuyTinItemTitle");
         windowName = "ShopTinWindow";
         mode = true;
         this.confirmWin = null;
         this.alertWin = null;
      }
      
      override public function init() : void
      {
         this.materialProxy = new MaterialProxyBig();
         this.materialProxy.x = 10;
         this.materialProxy.y = 50;
         addChild(this.materialProxy);
         this.titleText = new TextField();
         this.titleText.defaultTextFormat = new TextFormat(null,26,3381555,true);
         this.titleText.selectable = false;
         this.titleText.autoSize = TextFieldAutoSize.CENTER;
         this.titleText.x = 140;
         this.titleText.y = 50;
         this.titleText.width = 280;
         this.titleText.height = 40;
         this.titleText.visible = true;
         addChild(this.titleText);
         this.contentText = new TextField();
         this.contentText.defaultTextFormat = new TextFormat("_sans",12,8999699,false,false,false,null,null,TextFormatAlign.LEFT,null,null,0,10);
         this.contentText.selectable = false;
         this.contentText.multiline = true;
         this.contentText.wordWrap = true;
         this.contentText.styleSheet = LocalData.YD_SHEET;
         this.contentText.x = 150;
         this.contentText.y = 90;
         this.contentText.width = 280;
         this.contentText.height = 190;
         this.contentText.visible = true;
         addChild(this.contentText);
         this.numbericStepper = new NumbericStepper();
         this.numbericStepper.x = 36;
         this.numbericStepper.y = 160;
         this.numbericStepper.min_num = 1;
         this.numbericStepper.max_num = 99;
         this.numbericStepper.get_num = 1;
         this.numbericStepper.disable(true,0);
         this.numbericStepper.addEventListener(UIEvent.TEXT_CHANGE,this.numChange);
         addChild(this.numbericStepper);
         this.errorText = new ErrorText();
         this.errorText.x = 0;
         this.errorText.y = this.height - 80;
         this.errorText.text = "";
         this.errorText.visible = false;
         addChild(this.errorText);
         this.directionText = new TextField();
         this.directionText.selectable = false;
         this.directionText.x = 30;
         this.directionText.y = 185;
         this.directionText.width = 150;
         this.directionText.height = 50;
         this.directionText.defaultTextFormat = new TextFormat("_sans",12,8999699);
         this.directionText.multiline = false;
         this.directionText.visible = true;
         this.directionText.text = Language.replaceText("buyNum",{
            "minNum":1,
            "maxNum":99
         });
         addChild(this.directionText);
         this.qdBuyButton = new LipiButton();
         this.qdBuyButton.bgAlpha = 0;
         this.qdBuyButton.bgSkin = new LipiSkin(MaterialLib.getInstance().getClass("ButtonOrange"));
         this.qdBuyButton.width = 84;
         this.qdBuyButton.height = 25;
         this.qdBuyButton.x = width / 2 - this.qdBuyButton.width * 2 - 40 + 65;
         this.qdBuyButton.y = height - 44;
         this.qdBuyButton.label = "用元宝购买";
         this.qdBuyButton.textColor = 16777215;
         this.qdBuyButton.addEventListener(MouseEvent.CLICK,this.useQdBuy);
         addChild(this.qdBuyButton);
         this.cftBuybutton = new LipiButton();
         this.cftBuybutton.bgAlpha = 0;
         this.cftBuybutton.bgSkin = new LipiSkin(MaterialLib.getInstance().getClass("ButtonOrange"));
         this.cftBuybutton.width = 95;
         this.cftBuybutton.height = 25;
         this.cftBuybutton.x = width / 2 - this.cftBuybutton.width - 10 + 65;
         this.cftBuybutton.y = height - 44;
         this.cftBuybutton.label = "暂时无用";
         this.cftBuybutton.textColor = 16777215;
         this.cftBuybutton.addEventListener(MouseEvent.CLICK,this.useCFTBuy);
         addChild(this.cftBuybutton);
         this.cancelButton = new LipiButton();
         this.cancelButton.bgAlpha = 0;
         this.cancelButton.bgSkin = new LipiSkin(MaterialLib.getInstance().getClass("ButtonBlue"));
         this.cancelButton.width = 64;
         this.cancelButton.height = 25;
         this.cancelButton.x = width / 2 + 10 + 65;
         this.cancelButton.y = height - 44;
         this.cancelButton.label = "取消";
         this.cancelButton.textColor = 16777215;
         this.cancelButton.addEventListener(MouseEvent.CLICK,this.onCancel);
         addChild(this.cancelButton);
         this._specialDogPrice = new TextField();
         this._specialDogPrice.selectable = false;
         this._specialDogPrice.x = 10;
         this._specialDogPrice.y = 176;
         this._specialDogPrice.width = 150;
         this._specialDogPrice.height = 40;
         this._specialDogPrice.defaultTextFormat = new TextFormat("Verdana",12);
         this._specialDogPrice.multiline = true;
         addChild(this._specialDogPrice);
         this._specialDogPrice.visible = false;
         this._dogTipText = new TextField();
         this._dogTipText.multiline = false;
         this._dogTipText.height = 20;
         this._dogTipText.htmlText = "领养有效期：";
         this._dogTipText.x = 48;
         this._dogTipText.y = this.directionText.y + this.directionText.height + 25;
         addChild(this._dogTipText);
         this._dogTipText.visible = false;
         this.rbtnBuy1 = new RadioButton("1个月");
         this.setRaidoStyle(this.rbtnBuy1);
         this.rbtnBuy1.x = this._dogTipText.x + 75;
         this.rbtnBuy1.y = this._dogTipText.y;
         this.rbtnBuy2 = new RadioButton("6个月");
         this.setRaidoStyle(this.rbtnBuy2);
         this.rbtnBuy2.x = this.rbtnBuy1.x + 60;
         this.rbtnBuy2.y = this.rbtnBuy1.y;
         this.rbtnBuy3 = new RadioButton("12个月");
         this.setRaidoStyle(this.rbtnBuy3);
         this.rbtnBuy3.x = this.rbtnBuy1.x + 120;
         this.rbtnBuy3.y = this.rbtnBuy1.y;
         this.radioGroupDog = new RadioGroup();
         this.radioGroupDog.addTarget(this.rbtnBuy1);
         this.radioGroupDog.addTarget(this.rbtnBuy2);
         this.radioGroupDog.addTarget(this.rbtnBuy3);
         this.radioGroupDog.addEventListener(Event.CHANGE,this.onRadioBtnChanged);
         this.setData();
      }
      
      private function cftBuyThing() : void
      {
         var _loc2_:Number = NaN;
         var _loc1_:Object = MData.getInstance().mainData.host;
         if(_loc1_["yellowstatus"] != undefined && _loc1_["yellowstatus"] >= 1)
         {
            _loc2_ = Number(this.data["y"]);
         }
         else
         {
            _loc2_ = Number(this.data["qd"]);
         }
         Command.getInstance().mainCommand.verifyCFTRequest(data["id"],data["n"],data["t"],this.numbericStepper.get_num,data["appid"]);
         MainData.inGameBuyType = "Item";
         MainData.inGameBuyObject["itemType"] = data["t"];
         this.closeMe();
      }
      
      private function cancelButtonClick(param1:MouseEvent) : void
      {
         this.closeMe();
      }
      
      private function confirmWindowClick() : void
      {
         var _loc5_:int = 0;
         var _loc1_:Object = MData.getInstance().mainData.host;
         var _loc2_:Boolean = false;
         if(data["p"] == 0)
         {
            _loc2_ = true;
         }
         var _loc3_:int = 0;
         if(_loc1_["yellowstatus"] != undefined && _loc1_["yellowstatus"] >= 1)
         {
            _loc3_ = int(data["y"]);
         }
         else
         {
            _loc3_ = int(data["qd"]);
         }
         if(data.hasOwnProperty("setprice"))
         {
            if(data["setprice"] != "")
            {
               if(this.radioGroupDog.selectedTarget == this.rbtnBuy1)
               {
                  _loc5_ = 0;
               }
               else if(this.radioGroupDog.selectedTarget == this.rbtnBuy2)
               {
                  _loc5_ = 1;
               }
               else if(this.radioGroupDog.selectedTarget == this.rbtnBuy3)
               {
                  _loc5_ = 2;
               }
               this.numbericStepper.get_num = this.data["setprice"][_loc5_]["month"];
               _loc3_ = int(this.data["setprice"][_loc5_]["money"]);
               if(_loc1_["yellowstatus"] != undefined && _loc1_["yellowstatus"] >= 1)
               {
                  _loc3_ = int(this.data["ysetprice"][_loc5_]["money"]);
               }
            }
         }
         var _loc4_:TinItemCommand = Command.getInstance().tinCommand;
         if(!_loc2_)
         {
            _loc4_.buyTool(data["id"],this.numbericStepper.get_num,data["t"],_loc2_,data["n"],_loc3_,this);
         }
         else
         {
            _loc4_.verifyQBRequest(data["id"],data["t"],_loc2_,data["n"],_loc3_,this,this.numbericStepper.get_num,data["appid"]);
         }
         this.closeMe();
      }
      
      private function setData() : void
      {
         var _loc3_:Loader = null;
         var _loc4_:Sprite = null;
         if(data == null)
         {
            return;
         }
         if(!this.qdBuyButton)
         {
            return;
         }
         if(this.materialProxy != null)
         {
            if(data["t"] == 106)
            {
               _loc3_ = new Loader();
               this.materialProxy.addChild(_loc3_);
               _loc3_.load(new URLRequest(GetCropID.getHunterPicUrl(data["id"])));
               _loc3_.contentLoaderInfo.addEventListener(Event.COMPLETE,this.onLoadComplete);
            }
            else if(data["t"] == 10 && data["appid"] == 353)
            {
               removeChild(this.materialProxy);
               this.materialProxy = new WildMaterialLoaderProxy();
               addChild(this.materialProxy);
               this.materialProxy.setContent("weapon",data["id"],{"type":"Small"});
            }
            else
            {
               _loc4_ = MaterialLib.getInstance().getMaterial("Tool_" + data["t"] + "_" + data["id"]) as Sprite;
               this.materialProxy.addChild(_loc4_);
            }
            if(this.materialProxy.width < 140)
            {
               this.materialProxy.x = 10 + (140 - this.materialProxy.width) * 0.5;
            }
            if(this.materialProxy.height < 100)
            {
               this.materialProxy.y = 50 + (100 - this.materialProxy.height) * 0.5;
            }
            if(this.numbericStepper != null)
            {
               this.numbericStepper.y = this.materialProxy.y + this.materialProxy.height + 10;
            }
            if(this.directionText != null)
            {
               this.directionText.y = this.materialProxy.y + this.materialProxy.height + 35;
            }
         }
         if(this.titleText != null)
         {
            this.titleText.text = data["n"];
         }
         var _loc1_:Object = MData.getInstance().mainData.host;
         this.userMoney = _loc1_["money"];
         this.userFB = _loc1_["FB"];
         if(int(data["l"]) == 0)
         {
            if(this.numbericStepper != null)
            {
               this.numbericStepper.min_num = 0;
               this.numbericStepper.max_num = 0;
               this.numbericStepper.get_num = 0;
               this.numbericStepper.disable(true,2);
            }
            if(this.errorText != null)
            {
               this.errorText.text = "最近罐头购买量较大，今日已售完，请明天再来购买。";
               this.errorText.x = Math.floor(this.width - this.errorText.width) / 2;
               this.errorText.visible = true;
            }
            if(this.qdBuyButton != null)
            {
               this.qdBuyButton.enable = false;
               this.qdBuyButton.mouseEnabled = false;
               this.qdBuyButton.mouseChildren = false;
            }
            if(this.directionText != null)
            {
               this.directionText.visible = false;
            }
         }
         else if(data["shortage"] == 1)
         {
            if(this.numbericStepper != null)
            {
               this.numbericStepper.min_num = 0;
               this.numbericStepper.max_num = 0;
               this.numbericStepper.get_num = 0;
               this.numbericStepper.disable(true,2);
            }
            if(this.errorText != null)
            {
               this.errorText.text = "最近罐头购买量较大，今日已售完，请明天再来购买。";
               this.errorText.x = Math.floor(this.width - this.errorText.width) / 2;
               this.errorText.visible = true;
            }
            if(this.qdBuyButton != null)
            {
               this.qdBuyButton.enable = false;
               this.qdBuyButton.mouseEnabled = false;
               this.qdBuyButton.mouseChildren = false;
            }
            if(this.cftBuybutton != null)
            {
               this.cftBuybutton.enable = false;
               this.cftBuybutton.mouseEnabled = false;
               this.cftBuybutton.mouseChildren = false;
            }
            if(this.directionText != null)
            {
               this.directionText.visible = false;
            }
         }
         else
         {
            if(this.numbericStepper != null)
            {
               this.numbericStepper.max_num = 99;
            }
            if(this.qdBuyButton != null)
            {
               this.qdBuyButton.enable = true;
               this.qdBuyButton.mouseEnabled = true;
               this.qdBuyButton.mouseChildren = true;
            }
            if(this.directionText != null)
            {
               this.directionText.visible = true;
            }
         }
         if(this.contentText != null)
         {
            this.contentText.htmlText = this.formatDetailText(1);
         }
         if(data["t"] == 106 && Boolean(this.numbericStepper))
         {
            this.numbericStepper.visible = false;
            this.directionText.visible = false;
         }
         if(data["lt"])
         {
            this.errorText.text = data["lt"];
            this.errorText.visible = true;
            this.qdBuyButton.enable = false;
            this.cftBuybutton.enable = false;
            this.errorText.x = this.width / 2 - this.errorText.width / 2;
         }
         if(data["t"] == 106)
         {
            this.qdBuyButton.label = "用金币购买";
            this.cftBuybutton.visible = false;
            this.qdBuyButton.x = this.width / 2 - this.qdBuyButton.width * 2 + 80;
            this.cancelButton.x = this.width / 2 + 10;
         }
         if(data["t"] == 10 && data["appid"] == "353")
         {
            if(data["p"] != 0)
            {
               this.qdBuyButton.label = "用金币购买";
            }
            this.cftBuybutton.visible = false;
            this.qdBuyButton.x = this.width / 2 - this.qdBuyButton.width * 2 + 80;
            this.cancelButton.x = this.width / 2 + 10;
         }
         if(StaticTextTip.getInstance().showYellowTool(data["n"]))
         {
            this.freeGetArrows(data["n"]);
            this.qdBuyButton.y = height - 55;
            this.cancelButton.y = height - 55;
         }
         else if(this.tipSprite)
         {
            this.tipSprite.visible = false;
            this.qdBuyButton.y = height - 44;
            this.cancelButton.y = height - 44;
         }
         var _loc2_:Boolean = false;
         if(data.hasOwnProperty("setprice"))
         {
            if(data["setprice"] != "")
            {
               _loc2_ = true;
            }
         }
         if(_loc2_)
         {
            this.rbtnBuy1.selected = false;
            this.rbtnBuy2.selected = false;
            this.rbtnBuy3.selected = true;
            addChild(this.rbtnBuy1);
            addChild(this.rbtnBuy2);
            addChild(this.rbtnBuy3);
            this.radioGroupDog.selectedTarget = this.rbtnBuy3;
            this.errorText.visible = false;
            this.qdBuyButton.label = "确定";
            this.qdBuyButton.width = 65;
            this.qdBuyButton.enable = true;
            this.cftBuybutton.visible = false;
            this.qdBuyButton.x = this.width / 2 - this.qdBuyButton.width * 2 + 50;
            this.cancelButton.x = this.width / 2 + 10;
            height = 360;
            this.qdBuyButton.y = height - 55;
            this.cancelButton.y = height - 55;
            this._specialDogPrice.visible = true;
            this._specialDogPrice.htmlText = this.buildDogPriceText();
            this._dogTipText.visible = true;
         }
         else
         {
            this._specialDogPrice.visible = false;
            this._specialDogPrice.htmlText = "";
            this._dogTipText.visible = false;
         }
      }
      
      private function onRadioBtnChanged(param1:Event) : void
      {
         this._specialDogPrice.htmlText = this.buildDogPriceText();
      }
      
      private function getTextDisabledFormat() : TextFormat
      {
         if(!this.textDefaultFormat)
         {
            this.textDefaultFormat = new TextFormat("Verdana",12,8947848,null,null,null,null,null,"left");
         }
         return this.textDefaultFormat;
      }
      
      override public function keyEnter() : void
      {
         this.useQdBuy(null);
      }
      
      private function useQdBuy(param1:MouseEvent) : void
      {
         var _loc5_:int = 0;
         if(!this.qdBuyButton.enable)
         {
            return;
         }
         if(data["p"] != 0)
         {
            this.confirmWindowClick();
            return;
         }
         if(this.confirmWin == null)
         {
            this.confirmWin = new ConfirmWindow();
         }
         var _loc2_:Object = MData.getInstance().mainData.host;
         var _loc3_:int = int(this.data["qd"]);
         if(_loc2_["yellowstatus"] != undefined && _loc2_["yellowstatus"] >= 1)
         {
            _loc3_ = int(this.data["y"]);
         }
         var _loc4_:String = "您购买的物品需要支付&nbsp;<font size=\"12\" color=\"#FF6600\"><b>";
         _loc4_ = _loc4_ + int(this.numbericStepper.get_num * _loc3_).toString();
         _loc4_ = _loc4_ + "</b></font>&nbsp;元宝，是否确定？<br/>";
         _loc4_ = _loc4_ + "<br>";
         if(data.hasOwnProperty("setprice"))
         {
            if(data["setprice"] != "")
            {
               if(this.radioGroupDog.selectedTarget == this.rbtnBuy1)
               {
                  _loc5_ = 0;
               }
               else if(this.radioGroupDog.selectedTarget == this.rbtnBuy2)
               {
                  _loc5_ = 1;
               }
               else if(this.radioGroupDog.selectedTarget == this.rbtnBuy3)
               {
                  _loc5_ = 2;
               }
               _loc3_ = int(this.data["setprice"][_loc5_]["money"]);
               if(_loc2_["yellowstatus"] != undefined && _loc2_["yellowstatus"] >= 1)
               {
                  _loc3_ = int(this.data["ysetprice"][_loc5_]["money"]);
               }
               _loc4_ = "您购买的物品需要支付&nbsp;<font size=\"12\" color=\"#FF6600\"><b>";
               _loc4_ = _loc4_ + _loc3_.toString();
               _loc4_ = _loc4_ + "</b></font>&nbsp;元宝，是否确定？<br/>";
               _loc4_ = _loc4_ + "<br>";
            }
         }
         this.confirmWin.data = {"text":_loc4_};
         this.confirmWin.confirmFn = this.confirmWindowClick;
         WControl.open(this.confirmWin);
         switch(this.data["t"])
         {
            case 5:
               EventRecorder.recordSueecssEvent(EventRecorder.QD_BUYGZ,0,null,10);
               break;
            case 7:
               EventRecorder.recordSueecssEvent(EventRecorder.QD_BUYGT,0,null,10);
         }
      }
      
      private function onLoadComplete(param1:Event) : void
      {
         if(this.materialProxy.width < 140)
         {
            this.materialProxy.x = 10 + (140 - this.materialProxy.width) * 0.5;
         }
         if(this.materialProxy.height < 100)
         {
            this.materialProxy.y = 50 + (100 - this.materialProxy.height) * 0.5;
         }
      }
      
      private function closeMe() : void
      {
         var _loc1_:WindowEvent = new WindowEvent(WindowEvent.CLOSE);
         _loc1_.window = this;
         ViewControl.getInstance().dispatchEvent(_loc1_);
      }
      
      private function useCFTBuy(param1:MouseEvent) : void
      {
         var _loc3_:Number = NaN;
         if(!this.cftBuybutton.enable)
         {
            return;
         }
         if(this.confirmWin == null)
         {
            this.confirmWin = new ConfirmWindow();
         }
         var _loc2_:Object = MData.getInstance().mainData.host;
         if(_loc2_["yellowstatus"] != undefined && _loc2_["yellowstatus"] >= 1)
         {
            _loc3_ = Number(this.data["y"]);
         }
         else
         {
            _loc3_ = Number(this.data["qd"]);
         }
         this.cftBuyThing();
         switch(this.data["t"])
         {
            case 5:
               EventRecorder.recordSueecssEvent(EventRecorder.CFT_BUYGZ,0,null,10);
               break;
            case 7:
               EventRecorder.recordSueecssEvent(EventRecorder.CFT_BUYGT,0,null,10);
         }
      }
      
      private function onLinkUpgradeClicked(param1:TextEvent) : void
      {
      }
      
      private function buildDogPriceText() : String
      {
         var _loc1_:String = "";
         var _loc2_:int = 0;
         var _loc3_:int = 0;
         if(this.radioGroupDog.selectedTarget == this.rbtnBuy1)
         {
            _loc2_ = int(data["setprice"][0]["money"]);
            _loc3_ = int(data["ysetprice"][0]["money"]);
         }
         else if(this.radioGroupDog.selectedTarget == this.rbtnBuy2)
         {
            _loc2_ = int(data["setprice"][1]["money"]);
            _loc3_ = int(data["ysetprice"][1]["money"]);
         }
         else if(this.radioGroupDog.selectedTarget == this.rbtnBuy3)
         {
            _loc2_ = int(data["setprice"][2]["money"]);
            _loc3_ = int(data["ysetprice"][2]["money"]);
         }
         _loc1_ += "<textformat indent=\"2\">元宝价</textformat>：普通 <font size=\"11\" color=\"#0099FF\"><b>" + _loc2_.toString() + "</b></font> <font color=\"#003366\">元宝</font><br>";
         return _loc1_ + ("特惠价：VIP <font size=\"11\" color=\"#FF6600\"><b>" + _loc3_.toString() + "</b></font> <font color=\"#003366\">元宝</font>");
      }
      
      private function getTextDefaultFormat() : TextFormat
      {
         if(!this.textDefaultFormat)
         {
            this.textDefaultFormat = new TextFormat("Verdana",12,0,null,null,null,null,null,"left");
         }
         return this.textDefaultFormat;
      }
      
      private function onCancel(param1:MouseEvent) : void
      {
         this.cancelButtonClick(param1);
      }
      
      override public function set data(param1:Object) : void
      {
         super.data = param1;
         this.setData();
      }
      
      private function setRaidoStyle(param1:RadioButton) : void
      {
         param1.textDefaultFormat = this.getTextDefaultFormat();
         param1.textDisabledFormat = this.getTextDisabledFormat();
         param1.textSelectedFormat = this.getTextDefaultFormat();
      }
      
      private function numChange(param1:UIEvent) : void
      {
         if(this.contentText != null && this.numbericStepper != null)
         {
            this.contentText.htmlText = this.formatDetailText(this.numbericStepper.get_num);
         }
      }
      
      private function getCftPrice(param1:Number, param2:int) : Number
      {
         var _loc3_:Number = NaN;
         var _loc4_:String = null;
         _loc3_ = Number(param1) * 0.88 * 0.1;
         _loc4_ = _loc3_.toFixed(3);
         _loc4_ = _loc4_.substr(0,_loc4_.length - 1);
         _loc3_ = Number(_loc4_);
         _loc3_ *= param2;
         return Number(_loc3_.toFixed(2));
      }
      
      private function freeGetArrows(param1:String) : void
      {
         if(!this.tipSprite)
         {
            this.tipSprite = new Sprite();
         }
         this.tipText = new TextField();
         this.tipText.selectable = false;
         this.tipText.autoSize = TextFieldAutoSize.CENTER;
         this.tipText.defaultTextFormat = new TextFormat("Verdana",13,null,null,null,null,null,null,TextFormatAlign.CENTER);
         this.tipText.height = 25;
         this.tipText.htmlText = StaticTextTip.getInstance().ShopGetYellow(param1);
         this.tipText.x = this.width / 2 - this.tipText.width / 2;
         this.tipText.y = 0;
         var _loc2_:Shape = new Shape();
         _loc2_.graphics.beginFill(15590344);
         _loc2_.graphics.drawRect(0,0,this.width - 20,this.tipText.height);
         _loc2_.graphics.endFill();
         this.tipSprite.addChild(_loc2_);
         this.tipSprite.addChild(this.tipText);
         addChild(this.tipSprite);
         this.tipSprite.x = 10;
         this.tipSprite.y = this.height - this.tipText.height - 10;
      }
      
      private function formatDetailText(param1:int) : String
      {
         var _loc3_:Number = NaN;
         var _loc2_:String = "";
         if(data == null)
         {
            return _loc2_;
         }
         if(param1 <= 0)
         {
            param1 = 1;
         }
         if(data["p"] != 0)
         {
            _loc2_ += "<p>金币价：<font size=\"12\" color=\"#FF6600\"><b>" + data["p"] * param1 + "</b></font>&nbsp;<font color=\"#CC3300\">金币</font></p>";
            _loc3_ = parseInt(MData.getInstance().mainData.host["money"]);
            if(_loc3_ < data["p"] * param1)
            {
               this.errorText.text = "您的金币不足";
               this.qdBuyButton.enable = false;
               this.errorText.visible = true;
            }
            else
            {
               this.errorText.text = "";
               this.qdBuyButton.enable = true;
               this.errorText.visible = false;
            }
            this.errorText.x = this.width / 2 - this.errorText.width / 2;
         }
         else
         {
            _loc2_ += "<p><textformat indent=\"2\">元宝价</textformat>：普通&nbsp;<font size=\"12\" color=\"#FF6600\"><b>" + data["qd"] * param1 + "</b></font>&nbsp;元宝</p>";
            _loc2_ += "<p><textformat leading=\"1\">特惠价：VIP&nbsp;<font size=\"12\" color=\"#FF6600\"><b>" + data["y"] * param1 + "</b></font>&nbsp;元宝&nbsp;(节省 <font size=\"12\" color=\"#FF6600\"><b>" + (data["qd"] - data["y"]) * param1 + "</b></font>&nbsp;元宝)</textformat><br/>";
            _loc2_ += "<textformat indent=\"48\"><font size=\"12\" color=\"#666666\"></font></textformat></p>";
         }
         if(int(data["t"]) == 7)
         {
            _loc2_ += "<p><textformat blockindent=\"47\" indent=\"-39\" >类&nbsp;型：罐头</textformat></p>";
         }
         if(int(data["t"]) == 10 && int(data["appid"]) == 353)
         {
            _loc2_ += "<p><textformat blockindent=\"47\" indent=\"-39\" >类&nbsp;型：驱赶武器</textformat></p>";
         }
         if(int(data["t"]) == 106)
         {
            _loc2_ += "<p><textformat blockindent=\"47\" indent=\"-39\" >类&nbsp;型：看守员</textformat></p>";
         }
         if(int(data["t"]) == 5)
         {
            _loc2_ += "<p><textformat blockindent=\"47\" indent=\"-39\" >类&nbsp;型：工资</textformat></p>";
         }
         if(int(data["t"]) == 12)
         {
            _loc2_ += "<p><textformat blockindent=\"47\" indent=\"-39\" >类&nbsp;型：科研沙漏</textformat></p>";
         }
         if(data["tips"])
         {
            _loc2_ += "<p><textformat blockindent=\"47\" indent=\"-39\" >提&nbsp;示：" + data["tips"] + "</textformat></p>";
         }
         _loc2_ += "<p><textformat blockindent=\"47\" indent=\"-39\" leading=\"-1\">说&nbsp;明：" + data["d"] + "</textformat></p>";
         if(data.hasOwnProperty("setprice"))
         {
            if(data["setprice"] != "")
            {
               _loc2_ = "<p><textformat blockindent=\"47\" indent=\"-39\" >类&nbsp;型：特供看守员</textformat></p>";
               _loc2_ += "<p><textformat blockindent=\"47\" indent=\"-39\" leading=\"-1\">说&nbsp;明：" + data["d"] + "</textformat></p>";
            }
         }
         return _loc2_;
      }
   }
}

