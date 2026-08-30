package mc.view.main.window.shop
{
   import com.minutes.ui.control.LipiButton;
   import com.minutes.ui.core.LipiSkin;
   import com.qzone.qui.controls.RadioButton;
   import com.qzone.qui.makers.RadioGroup;
   import com.qzone.utils.StringUtil;
   import common.MaterialLib;
   import flash.display.Loader;
   import flash.display.MovieClip;
   import flash.display.Sprite;
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
   import mc.control.DiyItemCommand;
   import mc.control.ViewControl;
   import mc.events.WindowEvent;
   import mc.model.MData;
   import mc.model.MainData;
   import mc.view.ViewEvent;
   import mc.view.common.BaseWindow;
   import mc.view.common.ConfirmWindow;
   import mc.view.farm.GetCropID;
   import mc.view.main.WindowControl.WControl;
   import mc.view.main.tip.TipControl;

   public class ShopDiyWindow extends BaseWindow
   {

      private static const DIYTYPE:int = 6;

      private var cftButton:LipiButton;

      private var rbtnDiy:RadioButton;

      private var confirmButton:LipiButton;

      private var tip:TextField;

      private var detailText:String = "";

      private var _form:Object;

      private var isinit:Boolean = false;

      private var rbtnQB:RadioButton;

      private var userMoney:int = 0;

      private var radioGroup:RadioGroup;

      private var linkText:TextField;

      private var cancelButton:LipiButton;

      private var _directionText:TextField;

      private const diyLimitYDLevel:int = 4;

      private var errorText:ErrorText;

      private var qMoneyButton:LipiButton;

      private var _btnConfirm:LipiButton;

      private var rbtnCFT:RadioButton;

      private var cLevel:int = 99;

      private var rbtnJB:RadioButton;

      private var textDefaultFormat:TextFormat;

      private var _cancelConfirm:LipiButton;

      private var _shopToolForm:MovieClip;

      private const boxLoc:Object = {
         "n0":5,
         "n1":10,
         "n2":38,
         "n3":55
      };

      public function ShopDiyWindow()
      {
         super();
         width = 500;
         height = 355;
         titleIMG = MaterialLib.getInstance().getClass("DiyWindowTitle");
         windowName = "ShopDiyWindow";
         mode = true;
         ViewControl.getInstance().addEventListener("showWindow",this.showWindow);
      }

      private function useCFTBuy() : void
      {
         var _loc3_:Number = NaN;
         var _loc1_:ConfirmWindow = new ConfirmWindow();
         var _loc2_:Object = MData.getInstance().mainData.host;
         if(_loc2_["yellowstatus"] != undefined && _loc2_["yellowstatus"] >= 1)
         {
            _loc3_ = Number(this.data["YFBPrice"]);
         }
         else
         {
            _loc3_ = Number(this.data["FBPrice"]);
         }
         this.cftBuyThing();
         EventRecorder.recordSueecssEvent(EventRecorder.CFT_BUYZS,0,null,10);
      }

      private function setRaidoStyle(param1:RadioButton) : void
      {
         param1.textDefaultFormat = this.getTextDefaultFormat();
         param1.textDisabledFormat = this.getTextDisabledFormat();
         param1.textSelectedFormat = this.getTextDefaultFormat();
      }

      override public function init() : void
      {
         var _loc1_:LipiButton = null;
         this.isinit = true;
         this.errorText = new ErrorText();
         this.errorText.visible = false;
         this.errorText.y = 240;
         addChild(this.errorText);
         this._shopToolForm = MaterialLib.getInstance().getMaterial("ShopDiyForm") as MovieClip;
         this._shopToolForm.x = 270;
         this._shopToolForm.y = 50;
         addChild(this._shopToolForm);
         this.tip = new TextField();
         this.tip.defaultTextFormat = new TextFormat("Verdana",12,8999699);
         this.tip.selectable = false;
         this.tip.autoSize = TextFieldAutoSize.LEFT;
         this.tip.htmlText = "";
         this.tip.x = 235;
         this.tip.y = 210;
         this.tip.addEventListener(TextEvent.LINK,this.linkHandler);
         addChild(this.tip);
         _loc1_ = new LipiButton();
         _loc1_.bgAlpha = 0;
         _loc1_.bgSkin = new LipiSkin(MaterialLib.getInstance().getClass("ButtonOrange"));
         _loc1_.width = 64;
         _loc1_.height = 25;
         _loc1_.x = 90;
         _loc1_.y = height - 145;
         _loc1_.label = "预览";
         _loc1_.textColor = 16777215;
         _loc1_.addEventListener(MouseEvent.CLICK,this.operation);
         addChild(_loc1_);
         this.setRadioButton();
         this.setData();
      }

      private function getTextDisabledFormat() : TextFormat
      {
         if(!this.textDefaultFormat)
         {
            this.textDefaultFormat = new TextFormat("Verdana",12,8947848,null,null,null,null,null,"left");
         }
         return this.textDefaultFormat;
      }

      private function useGoldBuy() : void
      {
         this.confirmButtonClick();
      }

      private function cftBuyThing() : void
      {
         var _loc2_:Number = NaN;
         var _loc1_:Object = MData.getInstance().mainData.host;
         if(_loc1_["yellowstatus"] != undefined && _loc1_["yellowstatus"] >= 1)
         {
            _loc2_ = Number(this.data["YFBPrice"]);
         }
         else
         {
            _loc2_ = Number(this.data["FBPrice"]);
         }
         Command.getInstance().mainCommand.verifyCFTRequest(data["itemId"],data["itemName"],ShopDiyWindow.DIYTYPE,1);
         MainData.inGameBuyType = "DIY";
         MainData.inGameBuyObject["itemID"] = data["itemId"];
         MainData.inGameBuyObject["exp"] = data["exp"];
         WControl.close(this);
      }

      private function cancelButtonClick(param1:MouseEvent) : void
      {
         var _loc2_:WindowEvent = new WindowEvent(WindowEvent.CLOSE);
         _loc2_.window = this;
         ViewControl.getInstance().dispatchEvent(_loc2_);
      }

      private function confirmButtonClick(param1:MouseEvent = null) : void
      {
         Command.getInstance().mainCommand.buyDiy(data["itemId"],data["skin"],data["msg"],false);
         WControl.close(this);
      }

      private function setData() : void
      {
         if(!this._shopToolForm || !data)
         {
            return;
         }
         this.detailText = "";
         if(this._shopToolForm != null)
         {
            (this._shopToolForm.diyName as TextField).defaultTextFormat = new TextFormat("Verdana",26,3381555,true);
            this._shopToolForm.diyName.text = data.itemName;
         }
         if(data["price"] > 0)
         {
            this.detailText += "金币价：<font size=\"11\" color=\"#FF6600\"><b>" + data["price"] + "</b></font> <font color=\"#CC3300\">金币</font><br>";
         }
         var _loc1_:int = -60;
         if(data.FBPrice != 0)
         {
            this.detailText += "<textformat indent=\"2\">元宝价</textformat>：普通 <font size=\"11\" color=\"#0099FF\"><b>" + data["FBPrice"] + "</b></font> <font color=\"#003366\">元宝</font><br>";
            this.detailText += "特惠价：VIP <font size=\"11\" color=\"#FF6600\"><b>" + data["YFBPrice"] + "</b></font> <font color=\"#003366\">元宝</font> (节省 <font size=\"11\" color=\"#FF6600\"><b>" + (data["FBPrice"] - data["YFBPrice"]) + "</b></font> <font color=\"#003366\">元宝</font>)<br />";
            this.detailText += "<p align=\"right\"><font size=\"12\" color=\"#666666\"></font></p>";
         }
         this.detailText += "有效期：" + data.itemValidTime / 86400 + " 天，可获得经验值：" + data.exp + "<br />";
         this._shopToolForm.diyDetail.htmlText = StringUtil.replaceText(this.detailText,data);
         var _loc2_:Loader = new Loader();
         addChild(_loc2_);
         _loc2_.load(new URLRequest(GetCropID.getShopDiyUrl(data["itemId"])));
         var _loc3_:Sprite = MaterialLib.getInstance().getMaterial("DiyLine") as Sprite;
         addChild(_loc3_);
         _loc2_.x = 25;
         _loc2_.y = 50;
         _loc3_.x = 25;
         _loc3_.y = 50;
         this.tip.htmlText = data["link"];
      }

      private function onRollOut(param1:MouseEvent) : void
      {
         TipControl.hide();
      }

      private function getTextDefaultFormat() : TextFormat
      {
         if(!this.textDefaultFormat)
         {
            this.textDefaultFormat = new TextFormat("Verdana",12,0,null,null,null,null,null,"left");
         }
         return this.textDefaultFormat;
      }

      override public function keyEnter() : void
      {
         this.confirmButtonClick();
      }

      private function viewBg() : void
      {
         var _loc1_:PreviewBackWindow = new PreviewBackWindow();
         var _loc2_:WindowEvent = new WindowEvent(WindowEvent.OPEN);
         _loc2_.window = _loc1_;
         ViewControl.getInstance().dispatchEvent(_loc2_);
         this.visible = false;
         ViewControl.getInstance().dispatchEvent(new ViewEvent("hideWindow"));
         Command.getInstance().mainCommand.preview(data);
      }

      override public function set data(param1:Object) : void
      {
         super.data = param1;
      }

      private function setRadioButton() : void
      {
         var _loc7_:int = 0;
         var _loc1_:Sprite = new Sprite();
         addChild(_loc1_);
         _loc1_.x = 0;
         _loc1_.y = height - 115;
         this._btnConfirm = new LipiButton();
         this._btnConfirm.bgAlpha = 0;
         this._btnConfirm.bgSkin = new LipiSkin(MaterialLib.getInstance().getClass("ButtonOrange"));
         this._btnConfirm.width = 64;
         this._btnConfirm.height = 25;
         this._btnConfirm.x = width / 2 - this._btnConfirm.width - 5;
         this._btnConfirm.y = 77;
         this._btnConfirm.label = "确定";
         this._btnConfirm.textColor = 16777215;
         this._btnConfirm.addEventListener(MouseEvent.CLICK,this.confirmButtonClick);
         _loc1_.addChild(this._btnConfirm);
         this.cancelButton = new LipiButton();
         this.cancelButton.bgAlpha = 0;
         this.cancelButton.bgSkin = new LipiSkin(MaterialLib.getInstance().getClass("ButtonBlue"));
         this.cancelButton.width = 64;
         this.cancelButton.height = 25;
         this.cancelButton.x = width / 2;
         this.cancelButton.y = 77;
         this.cancelButton.label = "取消";
         this.cancelButton.textColor = 16777215;
         this.cancelButton.addEventListener(MouseEvent.CLICK,this.cancelButtonClick);
         _loc1_.addChild(this.cancelButton);
         this._directionText = new TextField();
         this._directionText.defaultTextFormat = new TextFormat("Verdana",12,13369344,false,null,null,null,null,TextFormatAlign.LEFT);
         this._directionText.width = 400;
         this._directionText.height = 21;
         this._directionText.x = 68;
         this._directionText.y = this.boxLoc["n3"];
         this._directionText.selectable = false;
         _loc1_.addChild(this._directionText);
         var _loc2_:int = 4;
         this.rbtnDiy = new RadioButton("VIP LV" + _loc2_ + "及以上免费装扮（无期限，不获得经验值）");
         this.setRaidoStyle(this.rbtnDiy);
         this.rbtnDiy.x = 68;
         this.rbtnDiy.y = this.boxLoc["n1"];
         this.rbtnJB = new RadioButton("金币买");
         this.setRaidoStyle(this.rbtnJB);
         this.rbtnJB.x = 68;
         this.rbtnJB.y = this.boxLoc["n2"];
         this.rbtnQB = new RadioButton("元宝买");
         this.setRaidoStyle(this.rbtnQB);
         this.rbtnQB.x = 148;
         this.rbtnQB.y = this.boxLoc["n2"];
         this.rbtnCFT = new RadioButton("暂时无用");
         this.setRaidoStyle(this.rbtnCFT);
         this.rbtnCFT.x = 228;
         this.rbtnCFT.y = this.boxLoc["n2"];
         var _loc3_:TextField = new TextField();
         _loc3_.text = "请选择：";
         _loc3_.selectable = false;
         _loc3_.x = 20;
         _loc3_.y = this.boxLoc["n1"];
         _loc3_.width = 50;
         _loc1_.addChild(_loc3_);
         this.radioGroup = new RadioGroup();
         this.radioGroup.removeTarget(this.rbtnDiy);
         this.radioGroup.removeTarget(this.rbtnJB);
         this.radioGroup.removeTarget(this.rbtnQB);
         this.radioGroup.removeTarget(this.rbtnCFT);
         this.rbtnDiy.selected = false;
         this.rbtnJB.selected = false;
         this.rbtnQB.selected = false;
         this.rbtnCFT.selected = false;
         if(this.rbtnJB.parent == null)
         {
            _loc1_.addChild(this.rbtnJB);
         }
         this.radioGroup.addTarget(this.rbtnJB);
         this.linkText = new TextField();
         this.linkText.htmlText = "";
         this.linkText.x = _loc3_.width + this.rbtnDiy.width + 20;
         this.linkText.y = this.boxLoc["n1"];
         _loc1_.addChild(this.linkText);
         this.rbtnDiy.enabled = false;
         this.rbtnJB.enabled = true;
         this.radioGroup.selectedTarget = this.rbtnJB;
         this.rbtnJB.selected = true;
         if(data["FBPrice"] != 0)
         {
            _loc7_ = int(data["FBPrice"]);
            if(this.rbtnQB.parent == null)
            {
               _loc1_.addChild(this.rbtnQB);
            }
            this.radioGroup.addTarget(this.rbtnQB);
            this.radioGroup.selectedTarget = this.rbtnQB;
            this.rbtnQB.selected = true;
            if(this.rbtnCFT.parent == null)
            {
               _loc1_.addChild(this.rbtnCFT);
            }
            this.radioGroup.addTarget(this.rbtnCFT);
            if(!this.rbtnDiy.selected && !this.rbtnJB.selected && !this.rbtnQB.selected)
            {
               this.radioGroup.selectedTarget = this.rbtnCFT;
               this.rbtnCFT.selected = true;
            }
         }
         else
         {
            if(this.rbtnQB.parent != null)
            {
               this.rbtnQB.parent.removeChild(this.rbtnQB);
            }
            if(this.rbtnCFT.parent != null)
            {
               this.rbtnCFT.parent.removeChild(this.rbtnCFT);
            }
         }
         this._btnConfirm.enable = true;
         this._directionText.text = "";
         this.addDashedLine(_loc1_);
      }

      private function diyByYellowLvl() : void
      {
         Command.getInstance().mainCommand.buyDiy(data["itemId"],data["skin"],data["msg"],false,0,"",0,true);
         WControl.close(this);
      }

      private function showWindow(param1:ViewEvent) : void
      {
         this.visible = true;
      }

      private function getCftPrice(param1:Number, param2:int) : Number
      {
         var _loc3_:Number = NaN;
         var _loc4_:String = null;
         _loc3_ = Number(param1) * 0.88 * 0.1;
         _loc4_ = _loc3_.toFixed(3);
         _loc4_ = _loc4_.substr(0,_loc4_.length - 1);
         _loc3_ = Number(_loc4_);
         return _loc3_ * param2;
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

      private function useFbBuy() : void
      {
         var _loc1_:Object = MData.getInstance().mainData.host;
         var _loc2_:DiyItemCommand = Command.getInstance().diyCommand;
         var _loc3_:int = 0;
         if(_loc1_["yellowstatus"] != undefined && _loc1_["yellowstatus"] >= 1)
         {
            _loc3_ = int(data["YFBPrice"]);
         }
         else
         {
            _loc3_ = int(data["FBPrice"]);
         }
         _loc2_.verifyQBRequest(data["itemId"],ShopDiyWindow.DIYTYPE,true,data["itemName"],_loc3_,this,data["exp"]);
         WControl.close(this);
         EventRecorder.recordSueecssEvent(EventRecorder.QD_BUYZS,0,null,10);
      }

      private function addDashedLine(param1:Sprite) : void
      {
         var _loc2_:Sprite = this.createDashedLine(13369344,466,2,2,4);
         param1.addChild(_loc2_);
         _loc2_.x = (this.width - _loc2_.width) / 2;
         _loc2_.y = this.boxLoc["n0"];
      }

      private function linkHandler(param1:TextEvent) : void
      {
         ExternalInterface.call("window.open",param1.text);
      }

      private function operation(param1:Event) : void
      {
         this.viewBg();
      }
   }
}
