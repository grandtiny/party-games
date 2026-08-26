package common.view.window
{
   import common.§_-Ac§;
   import common.§_-Yf§;
   import common.view.MaterialProxy;
   import flash.display.Sprite;
   import flash.text.TextField;
   import flash.text.TextFormat;
   import flash.text.TextFormatAlign;

   public class GiftItem extends Sprite
   {

      private var §_-a5§:TextField;

      private var _materialProxy:MaterialProxy;

      private var _data:Object;

      public function GiftItem(param1:Boolean)
      {
         super();
         this.§_-a5§ = new TextField();
         this.§_-a5§.embedFonts = false;
         this.§_-a5§.selectable = false;
         if(param1 == true)
         {
            this.§_-a5§.defaultTextFormat = new TextFormat("SimSun",20,16737792,true,null,null,null,null,TextFormatAlign.CENTER);
            this.§_-a5§.x = 0;
            this.§_-a5§.y = 105;
            this.§_-a5§.width = 120;
            this.§_-a5§.height = 30;
         }
         else
         {
            graphics.beginFill(0,0);
            graphics.drawRect(0,0,108,94);
            graphics.endFill();
            this.§_-a5§.defaultTextFormat = new TextFormat("SimSun",13,16737792,true,null,null,null,null,TextFormatAlign.CENTER);
            this.§_-a5§.x = 0;
            this.§_-a5§.y = 58;
            this.§_-a5§.width = 108;
            this.§_-a5§.height = 36;
            this.§_-a5§.wordWrap = true;
            this.§_-a5§.multiline = true;
         }
         addChild(this.§_-a5§);
         this._materialProxy = new MaterialProxy(param1 ? MaterialProxy.§_-4O§ : MaterialProxy.§_-ZT§);
         addChild(this._materialProxy);
         this._materialProxy.x = param1 ? 0 : 24;
         this._materialProxy.y = -3;
      }

      public function get data() : Object
      {
         return this._data;
      }

      public function set data(param1:Object) : void
      {
         this._data = param1;
         this.update();
      }

      private function update() : void
      {
         var _loc1_:String = "";
         if(this.data.hasOwnProperty("eType"))
         {
            if(this._materialProxy != null)
            {
               this._materialProxy.setContent(this.data["eType"],this.data["eParam"]);
            }
            _loc1_ = §_-Yf§.getNameByIDType(this.data["eType"],this.data["eParam"]);
            if(this.§_-a5§ != null)
            {
               this.§_-a5§.text = _loc1_ + "×" + (this.data["eType"] == §_-Ac§.§_-SJ§ ? "1" : this.data["eNum"]);
            }
         }
         else
         {
            if(this._materialProxy != null)
            {
               this._materialProxy.setContent(this.data["type"],this.data["id"]);
            }
            _loc1_ = §_-Yf§.getNameByIDType(this.data["type"],this.data["id"]);
            if(this.§_-a5§ != null)
            {
               this.§_-a5§.text = _loc1_ + "×" + (this.data["type"] == §_-Ac§.§_-SJ§ ? "1" : this.data["num"]);
            }
         }
         if(this._materialProxy != null && this.data["eType"] == §_-Ac§.§_-GM§)
         {
            this._materialProxy.scaleX = 0.85;
            this._materialProxy.scaleY = 0.85;
         }
      }
   }
}
