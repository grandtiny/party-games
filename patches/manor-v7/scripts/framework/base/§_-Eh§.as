package framework.base
{
   import §_-Iw§.§_-SF§;
   import com.qzone.qui.containers.TileList;
   import common.view.DataLoading;
   import flash.display.DisplayObjectContainer;
   import flash.display.Sprite;

   public class §_-Eh§ extends Sprite
   {
      protected var _view:DisplayObjectContainer;

      protected var _tile:TileList;

      protected var §_-3n§:int;

      protected var §_-0x§:int;

      protected var §_-C3§:DataLoading;

      public function §_-Eh§(param1:DisplayObjectContainer, param2:int, param3:int)
      {
         super();
         this.§_-0x§ = param2;
         this.§_-3n§ = param3;
         this._view = param1;
         this._tile = null;
         this.§_-TM§();
      }

      public function get tile() : TileList
      {
         return this._tile;
      }

      public function set tile(param1:TileList) : void
      {
         this._tile = param1;
      }

      public function get tileWidth() : int
      {
         return this.§_-0x§;
      }

      protected function §_-TM§() : void
      {
         if(this.§_-C3§ == null)
         {
            this.§_-C3§ = new DataLoading();
            this.§_-C3§.addEventListener(§_-SF§.§_-3e§,this.onLinkClicked);
            this.§_-C3§.x = (this.§_-0x§ - this.§_-C3§.width) / 2;
            this.§_-C3§.y = (this.§_-3n§ - this.§_-C3§.height) / 2;
            addChild(this.§_-C3§);
         }
      }

      protected function onCreateTile() : void
      {
      }

      public function set errText(param1:String) : void
      {
         if(this.§_-C3§ != null)
         {
            this.§_-C3§.errorText = param1;
         }
      }

      protected function setData() : void
      {
      }

      private function onLinkClicked(param1:§_-SF§) : void
      {
         if(param1 == null || param1.data == null)
         {
            return;
         }
         var _loc2_:§_-SF§ = new §_-SF§(§_-SF§.§_-3e§);
         _loc2_.data = param1.data;
         dispatchEvent(_loc2_);
      }

      public function get dataList() : Array
      {
         if(this._tile == null)
         {
            return null;
         }
         return this._tile.dataProvider;
      }

      public function set dataList(param1:Array) : void
      {
         if(this._tile == null)
         {
            this._tile = new TileList();
            this.onCreateTile();
            addChild(this._tile);
         }
         this._tile.dataProvider = param1;
         this.setData();
      }

      public function set §_-Q8§(param1:Boolean) : void
      {
         if(this.§_-C3§ != null)
         {
            this.§_-C3§.visible = param1;
         }
         if(this._tile != null)
         {
            this._tile.visible = !param1;
         }
      }
   }
}
