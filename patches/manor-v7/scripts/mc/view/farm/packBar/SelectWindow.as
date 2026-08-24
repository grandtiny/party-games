package mc.view.farm.packBar
{
   import com.minutes.ui.control.LipiButton;
   import com.minutes.ui.control.NumbericStepper;
   import com.minutes.ui.core.LipiSkin;
   import com.minutes.ui.core.UIEvent;
   import com.qzone.corelib.js.JSProxy;
   import common.MaterialLib;
   import flash.display.Sprite;
   import flash.events.Event;
   import flash.events.MouseEvent;
   import flash.events.TextEvent;
   import flash.filters.ColorMatrixFilter;
   import flash.text.TextField;
   import flash.text.TextFieldAutoSize;
   import flash.text.TextFormat;
   import flash.text.TextFormatAlign;
   import mc.control.Command;
   import mc.model.FarmData;
   import mc.model.MData;
   import mc.model.MainData;
   import mc.view.common.BaseWindow;
   import mc.view.common.DataLoading;
   import mc.view.farm.GetCropID;
   import mc.view.main.WindowControl.WControl;
   import mc.view.main.window.shop.ErrorText;
   
   public class SelectWindow extends BaseWindow
   {
      
      private var farmData:FarmData;
      
      private var cancelButton:LipiButton = new LipiButton();
      
      private var buyMucaoPic:Sprite;
      
      private var wl:Sprite;
      
      private var buyButton:LipiButton;
      
      private var confirmButton:LipiButton;
      
      private var errorText:ErrorText;
      
      private var mucaoPic:Sprite;
      
      private var infoTxt:TextField = new TextField();
      
      private var alertText:TextField;
      
      private var numbericStepper:NumbericStepper;
      
      private var dataLoading:DataLoading = new DataLoading();
      
      private var _confirmFn:Function;
      
      private var _confirmEnable:Boolean = true;
      
      private var yellowBuyText:TextField;
      
      public function SelectWindow()
      {
         super();
         width = 376;
         height = 345;
         titleIMG = MaterialLib.getInstance().getClass("AlertWindowTitle");
         windowName = "selectWindow";
         mode = true;
      }
      
      private function userSeedErr(param1:Event) : void
      {
         this.dataLoading.errorText = this.farmData.userSeedErr;
      }
      
      private function setData() : void
      {
         var _loc2_:Number = NaN;
         var _loc1_:MainData = MData.getInstance().mainData;
         if(_loc1_.me && Boolean(this.confirmButton))
         {
            this.height = 280;
            this.errorText.y = 180;
            this.confirmButton.y = this.height - 55;
            this.cancelButton.y = this.height - 55;
            this.infoTxt.visible = false;
            this.mucaoPic.visible = false;
            this.numbericStepper.y = 100;
         }
         if(this.buyButton)
         {
            this.buyButton.y = height - 55;
         }
         if(this.alertText != null && data != null)
         {
            this.errorText.text = "";
            this.confirmButton.enable = true;
            if(!_loc1_.me)
            {
               this.infoTxt.visible = true;
               this.wl.visible = true;
            }
            else
            {
               this.infoTxt.visible = false;
               this.wl.visible = false;
            }
            if(data.hasOwnProperty("text"))
            {
               this.alertText.htmlText = GetCropID.formatString(data["text"]);
            }
            if(!_loc1_.me)
            {
               this.numbericStepper.max_num = data.data["amount"] < MainData.MAX_FOOD ? int(data.data["amount"]) : int(MainData.MAX_FOOD);
               this.numbericStepper.get_num = data.data["amount"] < 10 ? data.data["amount"] : 10;
            }
            else
            {
               _loc2_ = MainData.MAX_FOOD - _loc1_.host["animalFood"];
               this.numbericStepper.max_num = data.data["amount"] < MainData.MAX_FOOD ? int(data.data["amount"]) : int(MainData.MAX_FOOD);
               this.numbericStepper.get_num = data.data["amount"] < _loc2_ ? data.data["amount"] : _loc2_;
            }
            if(data.data["amount"] == 0)
            {
               this.numbericStepper.min_num = 0;
               this.numbericStepper.get_num = 0;
               this.numbericStepper.leftButton.filters = [new ColorMatrixFilter([0.3,0.7,0.11,0,0,0.3,0.7,0.11,0,0,0.3,0.7,0.11,0,0,0,0,0,1,0])];
               this.numbericStepper.rightButton.filters = [new ColorMatrixFilter([0.3,0.7,0.11,0,0,0.3,0.7,0.11,0,0,0.3,0.7,0.11,0,0,0,0,0,1,0])];
               if(_loc1_.me)
               {
                  this.errorText.text = "对不起，您物品包中没有牧草了。";
                  this.confirmEnable = false;
               }
               else
               {
                  this.errorText.text = "对不起，您物品包中的牧草存量为0。您可以去农场\n种植，或通过高价购买来赠送。";
                  this.confirmEnable = false;
               }
            }
            else
            {
               this.numbericStepper.leftButton.filters = [];
               this.numbericStepper.rightButton.filters = [];
            }
            if(data.data["amount"] == 0 && !_loc1_.me)
            {
               this.buyButton.visible = true;
               this.confirmButton.visible = false;
               this.buyButton.addEventListener(MouseEvent.CLICK,this.buyButtonClick);
            }
            else
            {
               this.buyButton.visible = true;
               this.buyButton.addEventListener(MouseEvent.CLICK,this.buyButtonClick2);
               this.confirmButton.visible = true;
            }
            if(data.data["amount"] != 0)
            {
               this.buyButton.visible = false;
            }
            if(Boolean(this.farmData) && this.farmData.animalFood == MainData.MAX_FOOD)
            {
               this.numbericStepper.min_num = 0;
               this.numbericStepper.get_num = 0;
               this.buyButton.enable = false;
               this.confirmEnable = false;
               this.errorText.text = "饲料丰足，无需添加。";
            }
            this.errorText.x = (this.width - this.errorText.width) / 2;
         }
         if(this.confirmButton != null)
         {
            this.confirmButton.enable = this.confirmEnable;
         }
         if(_loc1_.me && this.yellowBuyText != null)
         {
            this.yellowBuyText.text = "VIP购买牧草享半价";
         }
      }
      
      public function set confirmEnable(param1:Boolean) : void
      {
         if(this.confirmButton != null)
         {
            this.confirmButton.enable = param1;
         }
         this._confirmEnable = param1;
      }
      
      private function userSeedLoading(param1:Event) : void
      {
         this.setVisible();
      }
      
      override public function init() : void
      {
         this.alertText = new TextField();
         this.alertText.selectable = false;
         var _loc1_:TextFormat = new TextFormat("Verdana",14,8999699,null,null,null,null,null,TextFormatAlign.CENTER);
         _loc1_.leading = 8;
         this.alertText.defaultTextFormat = _loc1_;
         this.alertText.width = width - 50;
         this.alertText.height = 80;
         this.alertText.x = (width - this.alertText.width) / 2;
         this.alertText.y = 50;
         this.alertText.wordWrap = true;
         this.alertText.multiline = true;
         this.alertText.htmlText = "";
         addChild(this.alertText);
         this.errorText = new ErrorText();
         this.errorText.visible = false;
         this.errorText.y = 214;
         addChild(this.errorText);
         this.mucaoPic = MaterialLib.getInstance().getMaterial("Mucao") as Sprite;
         this.mucaoPic.x = (width - this.mucaoPic.width) / 2;
         this.mucaoPic.y = 75;
         addChild(this.mucaoPic);
         this.confirmButton = new LipiButton();
         this.confirmButton.bgAlpha = 0;
         this.confirmButton.bgSkin = new LipiSkin(MaterialLib.getInstance().getClass("ButtonOrange"));
         this.confirmButton.width = 64;
         this.confirmButton.height = 25;
         this.confirmButton.x = width / 2 - this.confirmButton.width - 10;
         this.confirmButton.y = height - 55;
         this.confirmButton.label = "确定";
         this.confirmButton.textColor = 16777215;
         this.confirmButton.addEventListener(MouseEvent.CLICK,this.confirmButtonClick);
         addChild(this.confirmButton);
         this.buyButton = new LipiButton();
         this.buyButton.bgAlpha = 0;
         this.buyButton.bgSkin = new LipiSkin(MaterialLib.getInstance().getClass("ButtonOrange"));
         this.buyButton.width = 64;
         this.buyButton.height = 25;
         this.buyButton.x = width / 2 - this.confirmButton.width - 10;
         this.buyButton.y = height - 55;
         this.buyButton.label = "去购买";
         this.buyButton.textColor = 16777215;
         this.buyButton.visible = false;
         addChild(this.buyButton);
         this.cancelButton.bgAlpha = 0;
         this.cancelButton.bgSkin = new LipiSkin(MaterialLib.getInstance().getClass("ButtonBlue"));
         this.cancelButton.width = 64;
         this.cancelButton.height = 25;
         this.cancelButton.x = width / 2 + 10;
         this.cancelButton.y = height - 55;
         this.cancelButton.label = "关闭";
         this.cancelButton.textColor = 16777215;
         this.cancelButton.addEventListener(MouseEvent.CLICK,this.cancelButtonClick);
         addChild(this.cancelButton);
         this.numbericStepper = new NumbericStepper();
         this.numbericStepper.addEventListener(UIEvent.TEXT_CHANGE,this.numChange);
         this.numbericStepper.x = 140;
         this.numbericStepper.y = 190;
         this.numbericStepper.min_num = 1;
         addChild(this.numbericStepper);
         addChild(this.dataLoading);
         this.dataLoading.x = this.width / 2;
         this.dataLoading.y = 80;
         this.wl = MaterialLib.getInstance().getMaterial("WindowLine") as Sprite;
         this.wl.x = Math.floor((this.width - this.wl.width) / 2);
         this.wl.y = 256;
         this.wl.visible = false;
         addChild(this.wl);
         this.infoTxt.htmlText = "<font color=\'#666666\'>每赠送10棵牧草奖励1点经验</font>";
         this.infoTxt.autoSize = TextFieldAutoSize.LEFT;
         this.infoTxt.x = (this.width - this.infoTxt.width) / 2;
         this.infoTxt.selectable = false;
         this.infoTxt.y = 262;
         this.infoTxt.visible = false;
         addChild(this.infoTxt);
         this.yellowBuyText = new TextField();
         this.yellowBuyText.selectable = false;
         this.yellowBuyText.defaultTextFormat = new TextFormat("Verdana",12,16737792);
         this.yellowBuyText.x = (this.width - this.yellowBuyText.width) / 2 - 20;
         this.yellowBuyText.autoSize = TextFieldAutoSize.LEFT;
         this.yellowBuyText.y = 140;
         this.yellowBuyText.width = 168;
         this.yellowBuyText.htmlText = "";
         addChild(this.yellowBuyText);
         this.farmData = MData.getInstance().farmData;
         var _loc2_:MainData = MData.getInstance().mainData;
         if(!this.farmData.reloadUserSeed && Boolean(this.farmData.animalPackFood))
         {
            if(_loc2_.me)
            {
               this.data = {
                  "text":"请选择给自己添加牧草的数量",
                  "data":this.farmData.animalPackFood
               };
            }
            else
            {
               this.data = {
                  "text":"请选择赠送给【" + _loc2_.currentUser.userName + "】的牧草数量",
                  "data":this.farmData.animalPackFood
               };
            }
            return;
         }
         Command.getInstance().farmCommand.getUserSeed();
         this.farmData.addEventListener(FarmData.USER_SEED_LOADING,this.userSeedLoading,false,0,true);
         this.farmData.addEventListener(FarmData.USER_SEED_ERR,this.userSeedErr,false,0,true);
         this.farmData.addEventListener(FarmData.PACKAGE_FOOD,this.userSeedChange,false,0,true);
      }
      
      override public function set data(param1:Object) : void
      {
         super.data = param1;
         this.setData();
      }
      
      private function numChange(param1:UIEvent) : void
      {
      }
      
      private function buyButtonClick(param1:MouseEvent = null) : void
      {
         var _loc2_:BaseWindow = null;
         if(this.buyButton.enable == true)
         {
            _loc2_ = new BuyFoodWindow();
            WControl.open(_loc2_);
            WControl.close(this);
         }
      }
      
      private function confirmButtonClick(param1:MouseEvent = null) : void
      {
         if(this.confirmButton.enable == true)
         {
            WControl.close(this);
            this.confirmFn(this.numbericStepper.get_num);
         }
      }
      
      public function set confirmFn(param1:Function) : void
      {
         this._confirmFn = param1;
      }
      
      private function userSeedChange(param1:Event) : void
      {
         if(this.farmData.userSeed != null)
         {
            this.setVisible();
         }
         Debug.log(this.farmData.animalPackFood);
         var _loc2_:MainData = MData.getInstance().mainData;
         if(_loc2_.me)
         {
            this.data = {
               "text":"请选择给自己添加牧草的数量",
               "data":this.farmData.animalPackFood
            };
         }
         else
         {
            this.data = {
               "text":"请选择赠送给【" + _loc2_.currentUser.userName + "】的牧草数量",
               "data":this.farmData.animalPackFood
            };
         }
         this.setData();
      }
      
      public function get confirmFn() : Function
      {
         return this._confirmFn;
      }
      
      private function cancelButtonClick(param1:MouseEvent) : void
      {
         WControl.close(this);
      }
      
      private function linkHandler(param1:TextEvent) : void
      {
      }
      
      private function setVisible() : void
      {
         if(this.farmData.userSeedLoading == true)
         {
            this.dataLoading.visible = true;
         }
         else if(this.farmData.userSeed != null)
         {
            this.dataLoading.visible = false;
         }
      }
      
      override public function keyEnter() : void
      {
         this.confirmButtonClick();
      }
      
      private function buyButtonClick2(param1:MouseEvent = null) : void
      {
         if(this.buyButton.enable == true)
         {
            WControl.openForName("shop",{"tabSelected":1});
            WControl.close(this);
         }
      }
      
      public function get confirmEnable() : Boolean
      {
         return this._confirmEnable;
      }
   }
}

