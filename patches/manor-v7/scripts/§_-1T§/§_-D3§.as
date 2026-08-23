package §_-1T§
{
   import §_-0H§.BagItem;
   import §_-Iw§.§_-Yj§;
   import §_-JM§.§_-1R§;
   import §_-JM§.§_-3§;
   import common.§_-Ac§;
   import flash.events.Event;
   import flash.utils.setTimeout;
   import framework.base.§_-Gy§;
   import module.§_-Im§;
   
   public class §_-D3§ extends §_-Gy§
   {
      
      private var §_-Ub§:Boolean;
      
      private var showFishAfterReload:Boolean;

      private var selectFishOnFirstLoad:Boolean;
      
      private var bagView:§_-2o§;
      
      private var bagModel:§_-Ol§;
      
      public function §_-D3§(param1:§_-1R§)
      {
         super(param1);
         this.§_-Ub§ = false;
         this.showFishAfterReload = false;
         this.selectFishOnFirstLoad = true;
         this.bagView = null;
         this.bagModel = null;
      }
      
      private function onShowMyPack(param1:§_-Yj§) : void
      {
         if(param1.data != null && param1.data["close"] == true)
         {
            if(this.bagView != null)
            {
               this.bagView.show(false);
            }
         }
         else
         {
            if(this.bagView == null)
            {
               this.bagView = new §_-2o§(this);
               if(module != null && module.container != null)
               {
                  module.container.addChild(this.bagView);
               }
            }
            if(this.model.dirty == false)
            {
               if(this.showFishAfterReload)
               {
                  this.view.§_-Re§(1);
                  this.showFishAfterReload = false;
               }
               this.view.toggleVisible();
               this.showFishGuide();
            }
            else
            {
               this.§_-Ub§ = true;
               this.model.reload();
               §_-Im§.instance().hide();
            }
         }
      }
      
      override public function finalize() : void
      {
         super.finalize();
      }
      
      private function showFishGuide() : void
      {
         var _loc1_:§_-Im§ = §_-Im§.instance();
         if(_loc1_.currentStep == §_-Im§.§_-aJ§)
         {
            this.view.§_-Re§(1);
            _loc1_.showStep(§_-Im§.§_-4G§);
            _loc1_.autoHide(3);
         }
      }
      
      private function onBuyItemSuccess(param1:§_-Yj§) : void
      {
         this.markBoughtItem(param1 == null ? null : param1.data);
      }
      
      public function markBoughtItem(param1:Object) : void
      {
         if(param1 != null && String(param1["type"]) == §_-Ac§.§_-77§)
         {
            this.showFishAfterReload = true;
         }
         this.onBagDirty(null);
      }
      
      public function get view() : §_-2o§
      {
         return this.bagView;
      }
      
      private function onDataLoaded(param1:§_-Yj§) : void
      {
         var _loc2_:Boolean = false;
         var _loc3_:Boolean = false;
         if(this.§_-Ub§ == true)
         {
            _loc3_ = this.model.§_-AH§("fish").length > 0;
            _loc2_ = this.showFishAfterReload || this.selectFishOnFirstLoad && _loc3_ || this.model.§_-AH§("normal").length == 0 && _loc3_;
            this.showFishAfterReload = false;
            this.selectFishOnFirstLoad = false;
            this.view.show(true);
            this.showFishGuide();
            if(_loc2_)
            {
               setTimeout(this.selectFishTab,1);
            }
         }
         this.§_-Ub§ = false;
      }
      
      private function selectFishTab() : void
      {
         if(this.view != null && this.view.visible)
         {
            this.view.§_-Re§(1);
         }
      }
      
      override public function initialze() : void
      {
         super.initialze();
         if(module.container == null)
         {
            return;
         }
         if(this.bagModel == null)
         {
            this.bagModel = new §_-Ol§();
         }
         this.§_-Wl§();
      }
      
      private function onBagDirty(param1:Event) : void
      {
         if(this.model != null)
         {
            this.model.dirty = true;
         }
      }
      
      private function onBagAdded(param1:§_-Yj§) : void
      {
         this.onBagDirty(param1);
      }
      
      public function get model() : §_-Ol§
      {
         return this.bagModel;
      }
      
      private function §_-Wl§() : void
      {
         var _loc1_:§_-3§ = module.app as §_-3§;
         if(_loc1_ != null)
         {
            _loc1_.addEventListener(§_-Ac§.§_-EJ§,this.onShowMyPack,false,0,true);
            _loc1_.addEventListener(§_-Ac§.§_-8t§,this.onBuyItemSuccess,false,0,true);
            _loc1_.addEventListener(§_-Ac§.§_-Md§,this.onBagDirty,false,0,true);
            _loc1_.addEventListener(§_-Ac§.§_-Ke§,this.onBagRemoved,false,0,true);
            _loc1_.addEventListener(§_-Ac§.§_-Dv§,this.onBagAdded,false,0,true);
         }
         this.bagModel.addEventListener(§_-Ol§.§_-PU§,this.onDataLoaded,false,0,true);
      }
      
      private function onBagRemoved(param1:§_-Yj§) : void
      {
         if(param1 == null || param1.data == null)
         {
            return;
         }
         var _loc2_:int = param1.data["id"] as int;
         var _loc3_:int = param1.data["type"] as int;
         var _loc4_:BagItem = this.model.getItem(_loc2_,_loc3_);
         if(_loc4_ != null && _loc4_._amount > 0)
         {
            --_loc4_._amount;
            if(_loc4_._amount <= 0)
            {
               setCursor(§_-Ac§.§_-7g§,"");
            }
            this.onBagDirty(param1);
         }
      }
   }
}
