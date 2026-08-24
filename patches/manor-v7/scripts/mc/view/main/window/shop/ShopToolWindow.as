package mc.view.main.window.shop
{
   import com.minutes.ui.control.LipiButton;
   import com.minutes.ui.control.NumbericStepper;
   import com.minutes.ui.core.LipiSkin;
   import com.minutes.ui.core.UIEvent;
   import com.qzone.qui.controls.CheckBox;
   import common.LocalData;
   import common.MaterialLib;
   import flash.display.MovieClip;
   import flash.display.Sprite;
   import flash.events.Event;
   import flash.events.MouseEvent;
   import flash.events.TextEvent;
   import flash.external.ExternalInterface;
   import flash.text.TextField;
   import flash.text.TextFieldAutoSize;
   import flash.text.TextFormat;
   import flash.text.TextFormatAlign;
   import mc.control.Command;
   import mc.control.Version;
   import mc.control.ViewControl;
   import mc.events.WindowEvent;
   import mc.model.MData;
   import mc.model.MainData;
   import mc.view.common.BaseWindow;
   import mc.view.common.Language;
   import mc.view.common.MaterialProxyBig;
   import mc.view.common.MoneyIcon;
   
   public class ShopToolWindow extends BaseWindow
   {
      
      private var materialProxy:MaterialProxyBig;
      
      private var realPrice:int;
      
      private var directionText:TextField;
      
      private var confirmButton:LipiButton;
      
      private var halfMoneyText:TextField;
      
      private var errorText:ErrorText;
      
      private var priceText:TextField;
      
      private var userFB:int = 10000;
      
      private var diamondMoneyIcon:MoneyIcon;
      
      private var cb:CheckBox = new CheckBox();
      
      private var tipText:TextField;
      
      private var diamondPriceText:TextField;
      
      private var QpTip:TextField;
      
      private var numbericStepper:NumbericStepper;
      
      private var _shopToolForm:Object;
      
      private var userMoney:int = 500000;
      
      public function ShopToolWindow()
      {
         super();
         width = 445;
         height = 328;
         titleIMG = MaterialLib.getInstance().getClass("BuyFoodTitle");
         windowName = "ShopToolWindow";
         mode = true;
      }
      
      override public function keyEnter() : void
      {
         this.confirmButtonClick();
      }
      
      private function overflow(param1:int) : void
      {
         var _loc2_:MainData = null;
         var _loc3_:Number = NaN;
         if(data["price"] != 0)
         {
            _loc2_ = MData.getInstance().mainData;
            if(this.userMoney < this.realPrice * param1)
            {
               if(this.confirmButton != null)
               {
                  this.confirmButton.enable = false;
               }
               if(this.errorText != null)
               {
                  this.errorText.text = "对不起，您的金币不足。";
                  this.errorText.x = Math.floor((this.width - this.errorText.width) / 2);
                  this.errorText.visible = true;
                  return;
               }
            }
            else
            {
               if(this.confirmButton != null)
               {
                  this.confirmButton.enable = true;
               }
               if(this.errorText != null)
               {
                  this.errorText.text = "";
                  this.errorText.visible = false;
               }
            }
            if(data["tId"] == 1 && this.cb.selected && param1 + _loc2_.host["animalFood"] > MainData.MAX_FOOD)
            {
               if(this.confirmButton != null)
               {
                  this.confirmButton.enable = false;
               }
               if(this.errorText != null)
               {
                  _loc3_ = MainData.MAX_FOOD - _loc2_.host["animalFood"];
                  if(_loc3_ == 0)
                  {
                     this.errorText.text = "饲料丰足，无需添加。";
                  }
                  else
                  {
                     this.errorText.text = "牧场最多需要添加" + String(_loc3_) + "棵牧草";
                  }
                  this.errorText.x = Math.floor((this.width - this.errorText.width) / 2);
                  this.errorText.visible = true;
               }
            }
         }
         else if(this.userFB > 0 || Version.SNS != Version.QQ)
         {
            if(this.userFB < data["FBPrice"] * param1)
            {
               if(this.confirmButton != null)
               {
                  this.confirmButton.enable = false;
               }
               if(this.errorText != null)
               {
                  this.errorText.text = "您的元宝不足。";
                  this.errorText.x = Math.floor((this.width - this.errorText.width) / 2);
                  this.errorText.visible = true;
               }
            }
            else
            {
               if(this.confirmButton != null)
               {
                  this.confirmButton.enable = true;
               }
               if(this.errorText != null)
               {
                  this.errorText.text = "";
                  this.errorText.visible = false;
               }
            }
         }
      }
      
      private function numChange(param1:UIEvent = null) : void
      {
         var _loc2_:int = 0;
         if(data["price"] != 0)
         {
            _loc2_ = data["price"] * this.numbericStepper.get_num;
         }
         else
         {
            _loc2_ = data["FBPrice"] * this.numbericStepper.get_num;
            if(this.diamondPriceText != null)
            {
               this.diamondPriceText.htmlText = "" + data["YFBPrice"] * this.numbericStepper.get_num + "</b></font> 元宝 (节省 <font size=\"11\" color=\"#FF6600\"><b>" + (data["FBPrice"] * this.numbericStepper.get_num - data["YFBPrice"] * this.numbericStepper.get_num) + "</b></font> 元宝)";
            }
         }
         this.priceText.htmlText = "金币价：<font color=\'#FF6600\'><b>" + _loc2_.toString() + "</b></font> 金币";
         this.halfMoneyText.htmlText = "";
         this.overflow(this.numbericStepper.get_num);
      }
      
      private function cancelButtonClick(param1:MouseEvent) : void
      {
         var _loc2_:WindowEvent = new WindowEvent(WindowEvent.CLOSE);
         _loc2_.window = this;
         ViewControl.getInstance().dispatchEvent(_loc2_);
      }
      
      private function confirmButtonClick(param1:MouseEvent = null) : void
      {
         var _loc2_:Object = null;
         var _loc3_:Boolean = false;
         var _loc4_:WindowEvent = null;
         if(this.confirmButton.enable == true)
         {
            _loc2_ = MData.getInstance().mainData.host;
            _loc3_ = false;
            if(data["price"] == 0)
            {
               _loc3_ = true;
            }
            if(_loc2_["yellowstatus"] >= 1)
            {
               Command.getInstance().mainCommand.buyTool(data["tId"],this.numbericStepper.get_num,data["type"],_loc3_,data["tName"],data["YFBPrice"],this.cb.selected);
            }
            else
            {
               Command.getInstance().mainCommand.buyTool(data["tId"],this.numbericStepper.get_num,data["type"],_loc3_,data["tName"],data["FBPrice"],this.cb.selected);
            }
            _loc4_ = new WindowEvent(WindowEvent.CLOSE);
            _loc4_.window = this;
            ViewControl.getInstance().dispatchEvent(_loc4_);
         }
      }
      
      override public function set data(param1:Object) : void
      {
         super.data = param1;
         this.setData();
      }
      
      override public function init() : void
      {
         var line:Sprite;
         var gaojia:MovieClip;
         var cancelButton:LipiButton = null;
         this.materialProxy = new MaterialProxyBig();
         this.materialProxy.x = 30;
         this.materialProxy.y = 50;
         addChild(this.materialProxy);
         this.priceText = new TextField();
         this.priceText.selectable = false;
         this.priceText.defaultTextFormat = new TextFormat("Verdana",12,8999699);
         this.priceText.width = 155;
         this.priceText.height = 22;
         this.priceText.x = 160;
         this.priceText.y = 83;
         addChild(this.priceText);
         this.halfMoneyText = new TextField();
         with(this.halfMoneyText)
         {
            selectable = false;
            defaultTextFormat = new TextFormat("Verdana",12);
            autoSize = TextFieldAutoSize.LEFT;
            x = 160;
            y = 105;
         }
         addChild(this.halfMoneyText);
         this.diamondPriceText = new TextField();
         this.diamondPriceText.x = 155;
         this.diamondPriceText.y = 98;
         this.diamondPriceText.selectable = false;
         this.diamondPriceText.defaultTextFormat = new TextFormat("Verdana",12,3355443,false,null,null,null,null,TextFormatAlign.LEFT);
         this.diamondPriceText.styleSheet = LocalData.YD_SHEET;
         this.diamondPriceText.text = "";
         this.diamondPriceText.width = 220;
         this.diamondPriceText.height = 22;
         this.diamondPriceText.visible = false;
         addChild(this.diamondPriceText);
         line = this.createDashedLine(16103542,396,2,2,4);
         addChild(line);
         line.x = (this.width - line.width) / 2;
         line.y = 210;
         gaojia = MaterialLib.getInstance().getMaterial("Gaojia") as MovieClip;
         addChild(gaojia);
         gaojia.x = 372;
         gaojia.y = 32;
         this.cb.defaultSkin = MaterialLib.getInstance().getClass("cbSkin");
         this.cb.selectedSkin = MaterialLib.getInstance().getClass("cbSkin2");
         this.cb.addEventListener(Event.CHANGE,this.cbChange);
         this.cb.textDefaultFormat.color = 8999699;
         this.cb.textDefaultFormat.bold = true;
         this.cb.x = 20;
         this.cb.y = 260;
         this.cb.text = "全部放入饲料机";
         addChild(this.cb);
         this.cb.selected = true;
         this.cb.useHandCursor = true;
         this.numbericStepper = new NumbericStepper();
         this.numbericStepper.max_num = MainData.MAX_FOOD;
         this.numbericStepper.x = 40;
         this.numbericStepper.y = 160;
         this.numbericStepper.addEventListener(UIEvent.TEXT_CHANGE,this.numChange);
         addChild(this.numbericStepper);
         this._shopToolForm = MaterialLib.getInstance().getMaterial("ShopToolForm") as Object;
         this._shopToolForm.x = 156;
         this._shopToolForm.y = 60;
         addChild(this._shopToolForm as Sprite);
         this.errorText = new ErrorText();
         this.errorText.visible = false;
         this.errorText.y = 254;
         addChild(this.errorText);
         this.directionText = new TextField();
         this.directionText.selectable = false;
         this.directionText.x = 30;
         this.directionText.y = 185;
         this.directionText.width = 150;
         this.directionText.height = 50;
         this.directionText.defaultTextFormat = new TextFormat("Verdana",12,8999699);
         this.directionText.text = Language.replaceText("buyNum",{
            "minNum":1,
            "maxNum":MainData.MAX_FOOD
         });
         this.directionText.multiline = true;
         addChild(this.directionText);
         this.confirmButton = new LipiButton();
         this.confirmButton.bgAlpha = 0;
         this.confirmButton.bgSkin = new LipiSkin(MaterialLib.getInstance().getClass("ButtonOrange"));
         this.confirmButton.width = 64;
         this.confirmButton.height = 25;
         this.confirmButton.x = width / 2 - this.confirmButton.width - 10;
         this.confirmButton.y = height - 40;
         this.confirmButton.label = "确定";
         this.confirmButton.textColor = 16777215;
         this.confirmButton.addEventListener(MouseEvent.CLICK,this.confirmButtonClick);
         addChild(this.confirmButton);
         cancelButton = new LipiButton();
         cancelButton.bgAlpha = 0;
         cancelButton.bgSkin = new LipiSkin(MaterialLib.getInstance().getClass("ButtonBlue"));
         cancelButton.width = 64;
         cancelButton.height = 25;
         cancelButton.x = width / 2 + 10;
         cancelButton.y = height - 40;
         cancelButton.label = "取消";
         cancelButton.textColor = 16777215;
         cancelButton.addEventListener(MouseEvent.CLICK,this.cancelButtonClick);
         addChild(cancelButton);
         this.tipText = new TextField();
         this.tipText.width = 394;
         this.tipText.wordWrap = true;
         this.tipText.multiline = true;
         this.tipText.autoSize = TextFieldAutoSize.LEFT;
         this.tipText.x = (this.width - this.tipText.width) / 2;
         this.tipText.selectable = false;
         this.tipText.mouseWheelEnabled = false;
         addChild(this.tipText);
         this.tipText.y = 216;
         this.setData();
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
      
      private function getRealPrice(param1:int) : int
      {
         return param1;
      }
      
      private function cbChange(param1:Event) : void
      {
         this.overflow(this.numbericStepper.get_num);
      }
      
      private function linkHandler(param1:TextEvent) : void
      {
      }
      
      private function setData() : void
      {
         var _loc2_:TextFormat = null;
         var _loc3_:Number = NaN;
         var _loc4_:int = 0;
         var _loc5_:Number = NaN;
         if(data == null)
         {
            return;
         }
         if(this.directionText)
         {
            this.directionText.text = Language.replaceText("buyNum",{
               "minNum":1,
               "maxNum":MainData.MAX_FOOD
            });
         }
         if(this.tipText)
         {
            _loc2_ = new TextFormat();
            _loc2_.leading = 4;
            _loc2_.color = 16737792;
            this.tipText.htmlText = "道具统一使用金币购买。";
            this.tipText.setTextFormat(_loc2_);
         }
         if(this.priceText != null)
         {
            if(data["price"] != 0)
            {
               this.priceText.defaultTextFormat = new TextFormat("Verdana",12,8999699);
               this.priceText.htmlText = "金币价：<font color=\'#FF6600\'><b>" + data["price"] + "</b></font> 金币";
               this.halfMoneyText.htmlText = "";
               if(this.diamondPriceText)
               {
                  this.diamondPriceText.visible = false;
               }
            }
            else
            {
               this.priceText.defaultTextFormat = new TextFormat("Verdana",11,16737792,true);
               this.priceText.text = data["FBPrice"];
               if(this.diamondPriceText)
               {
                  this.diamondPriceText.visible = true;
                  this.diamondPriceText.htmlText = "" + data["YFBPrice"] * this.numbericStepper.get_num + "</b></font> 元宝 (节省 <font size=\"11\" color=\"#FF6600\"><b>" + (data["FBPrice"] * this.numbericStepper.get_num - data["YFBPrice"] * this.numbericStepper.get_num) + "</b></font> 元宝)";
               }
            }
         }
         if(this.materialProxy != null)
         {
            this.materialProxy.setContent("2525",data["tId"]);
         }
         var _loc1_:Object = MData.getInstance().mainData.host;
         this.userMoney = _loc1_["money"];
         this.realPrice = this.getRealPrice(data["price"]);
         this.userFB = _loc1_["FB"];
         this.overflow(1);
         if(this._shopToolForm != null)
         {
            this._shopToolForm.toolName.defaultTextFormat = new TextFormat("Verdana",26,3381555,true);
            this._shopToolForm.toolName.text = data["tName"];
            this._shopToolForm.toolName.y -= 20;
            this._shopToolForm.depict.htmlText = data["depict"];
            this._shopToolForm.consume.htmlText = data["consume"];
            _loc3_ = MainData.MAX_FOOD - _loc1_["animalFood"];
            _loc4_ = int(this.userMoney / this.realPrice);
            this.numbericStepper.get_num = _loc3_ < _loc4_ ? _loc3_ : _loc4_;
            if(this.numbericStepper.get_num < 1)
            {
               this.numbericStepper.get_num = 1;
            }
         }
         if(this.priceText)
         {
            _loc5_ = data["price"] * this.numbericStepper.get_num;
            this.priceText.htmlText = "金币价：<font color=\'#FF6600\'><b>" + _loc5_.toString() + "</b></font> 金币";
            this.halfMoneyText.htmlText = "";
         }
      }
   }
}

