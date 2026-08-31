package mc.view.main.window.shop
{
   import com.minutes.ui.collections.LipiListChild;
   import common.MaterialLib;
   import flash.display.Loader;
   import flash.display.Shape;
   import flash.display.Sprite;
   import flash.events.MouseEvent;
   import flash.net.URLRequest;
   import flash.text.TextField;
   import flash.text.TextFieldAutoSize;
   import flash.text.TextFormat;
   import flash.text.TextFormatAlign;
   import mc.control.ViewControl;
   import mc.events.TipEvent;
   import mc.view.ViewEvent;
   import mc.view.common.MaterialProxy;
   import mc.view.common.MoneyIcon;
   import mc.view.farm.GetCropID;

   public class ShopDiyItem extends LipiListChild
   {

      public static var CHILD_OVER:String = "childOver";

      public static var CHILD_OUT:String = "childOut";

      public static var CHILD_MOVE:String = "childMove";

      private var _material:MaterialProxy;

      private var priceText:TextField;

      private var goldIcon:MoneyIcon;

      public function ShopDiyItem()
      {
         super();
         this.buttonMode = true;
         this.useHandCursor = true;
         this.priceText = new TextField();
         this.priceText.defaultTextFormat = new TextFormat("Verdana",12,null,true,null,null,null,null,TextFormatAlign.LEFT,null,null,null,5);
         this.priceText.selectable = false;
         this.priceText.width = 200;
         this.priceText.autoSize = TextFieldAutoSize.LEFT;
         this.priceText.multiline = true;
         addChild(this.priceText);
         this.priceText.x = 0;
         this.priceText.y = 157;
         this._material = new MaterialProxy();
         addChild(this._material);
         addEventListener(MouseEvent.CLICK,this.onClick);
         addEventListener(MouseEvent.ROLL_OVER,this.onOver);
         addEventListener(MouseEvent.ROLL_OUT,this.onOut);
         var _loc1_:Shape = new Shape();
         _loc1_.graphics.beginFill(16711680,0);
         _loc1_.graphics.drawRect(0,0,10,1);
         _loc1_.graphics.endFill();
         _loc1_.y = 100;
         addChild(_loc1_);
      }

      private function onClick(param1:MouseEvent) : void
      {
         if(int(data["owned"]) == 1)
         {
            return;
         }
         var _loc2_:ViewEvent = new ViewEvent(ViewEvent.CHILD_CLICK,true);
         _loc2_.data = data;
         dispatchEvent(_loc2_);
      }

      private function onOut(param1:MouseEvent) : void
      {
         var _loc2_:TipEvent = new TipEvent(TipEvent.TIP_HIDE);
         _loc2_.tipType = "MouseTip";
         ViewControl.getInstance().dispatchEvent(_loc2_);
      }

      private function onOver(param1:MouseEvent) : void
      {
         var _loc2_:TipEvent = new TipEvent(TipEvent.TIP_SHOW);
         _loc2_.tipType = "MouseTip";
         _loc2_.tipArgument = data["itemName"] + "\n" + (int(data["owned"]) == 1 ? "已购买" : "可得经验：" + data["exp"]);
         ViewControl.getInstance().dispatchEvent(_loc2_);
      }

      override public function set data(param1:Object) : void
      {
         if(!param1)
         {
            return;
         }
         super.data = param1;
         var _loc2_:Loader = new Loader();
         addChild(_loc2_);
         _loc2_.load(new URLRequest(GetCropID.getShopDiyUrl(data["itemId"])));
         var _loc3_:Sprite = MaterialLib.getInstance().getMaterial("DiyLine") as Sprite;
         addChild(_loc3_);
         var _loc4_:Boolean = int(param1["owned"]) == 1;
         this.buttonMode = !_loc4_;
         this.useHandCursor = !_loc4_;
         this.mouseEnabled = !_loc4_;
         this.mouseChildren = !_loc4_;
         var _loc5_:String = "";
         if(_loc4_)
         {
            _loc5_ = "<font color='#4b7f52'><b>已购买</b></font>";
         }
         else
         {
            if(param1["price"] > 0)
            {
               _loc5_ += "<font color='#cc3300'>金币 <font/><font color='#f2693d'>" + param1["price"] + "</font> ";
            }
            if(param1["FBPrice"] > 0 && param1["YFBPrice"] > 0)
            {
               if(param1["price"] > 0)
               {
                  _loc5_ += "<br>";
               }
               _loc5_ += "<font color='#895313'>元宝 </font><font color='#f2693d'>" + param1["FBPrice"] + "</font> <font color='#f39800'>(VIP价 " + param1["YFBPrice"] + " )</font>";
            }
         }
         this.priceText.htmlText = _loc5_;
      }
   }
}
