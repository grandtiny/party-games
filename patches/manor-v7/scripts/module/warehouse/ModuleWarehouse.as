package module.warehouse
{
   import §_-1T§.§_-D3§;
   import §_-Iw§.§_-Yj§;
   import common.§_-Ac§;
   import framework.base.§_-5w§;
   import framework.base.§_-90§;
   import module.FarmApplication;
   import module.warehouse.house.§_-0l§;
   
   public class ModuleWarehouse extends §_-90§
   {
      
      private var m_warehouseCtrl:§_-0l§;
      
      private var m_myBagCtrl:§_-D3§;
      
      private var pendingBagItem:Object;
      
      public function ModuleWarehouse(param1:FarmApplication)
      {
         super(param1);
         this.pendingBagItem = null;
         param1.addEventListener(§_-Ac§.§_-8t§,this.onBagItemBought,false,0,false);
      }
      
      private function onBagItemBought(param1:§_-Yj§) : void
      {
         if(this.§_-E6§ == false && param1 != null && param1.data != null)
         {
            this.pendingBagItem = param1.data;
            app.dispatchEvent(new §_-Yj§(§_-Ac§.§_-EJ§,{"close":true}));
         }
      }
      
      override public function onNetRequestStopped() : void
      {
      }
      
      override public function load(param1:§_-5w§) : void
      {
         super.load(param1);
         this.m_myBagCtrl = new §_-D3§(this);
         this.m_myBagCtrl.initialze();
         this.m_warehouseCtrl = new §_-0l§(this);
         this.m_warehouseCtrl.initialze();
         if(this.pendingBagItem != null)
         {
            this.m_myBagCtrl.markBoughtItem(this.pendingBagItem);
            app.dispatchEvent(new §_-Yj§(§_-Ac§.§_-8t§,this.pendingBagItem));
            this.pendingBagItem = null;
         }
      }
      
      override public function unload() : void
      {
         if(this.m_myBagCtrl != null)
         {
            this.m_myBagCtrl.finalize();
            this.m_myBagCtrl = null;
         }
         if(this.m_warehouseCtrl != null)
         {
            this.m_warehouseCtrl.finalize();
            this.m_warehouseCtrl = null;
         }
      }
      
      override public function get name() : String
      {
         return §_-Ac§.§_-EI§;
      }
      
      override public function onGameLoop(param1:Number) : void
      {
      }
   }
}
