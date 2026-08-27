package §_-1T§
{
   import §_-0H§.BagItem;
   import §_-3i§.§_-Ep§;
   import §_-Iw§.§_-SF§;
   import §_-Iw§.§_-Yj§;
   import §_-JM§.§_-1R§;
   import §_-JM§.§_-3§;
   import common.§_-Ac§;
   import flash.events.Event;
   import flash.utils.setTimeout;
   import framework.base.§_-Gy§;
   import framework.net.NetHelper;
   import framework.net.§_-99§;
   import framework.net.vo.§_-P9§;
   import module.§_-Im§;
   
   public class §_-D3§ extends §_-Gy§
   {
      
      private var §_-Ub§:Boolean;
      
      private var showFishAfterReload:Boolean;

      private var selectFishOnFirstLoad:Boolean;

      private var openingToolPackage:Boolean;
      
      private var bagView:§_-2o§;
      
      private var bagModel:§_-Ol§;
      
      public function §_-D3§(param1:§_-1R§)
      {
         super(param1);
         this.§_-Ub§ = false;
         this.showFishAfterReload = false;
         this.selectFishOnFirstLoad = true;
         this.openingToolPackage = false;
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
               this.bagView.addEventListener(§_-SF§.§_-ZN§,this.onBagItemClick,false,1000,true);
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

      private function onBagItemClick(param1:§_-SF§) : void
      {
         if(param1 == null || param1.data == null)
         {
            return;
         }
         var _loc2_:BagItem = param1.data as BagItem;
         if(_loc2_ == null || _loc2_._type.toString() != §_-Ac§.§_-Ux§ || _loc2_._cId < 9101 || _loc2_._cId > 9106)
         {
            return;
         }
         param1.stopImmediatePropagation();
         if(this.openingToolPackage)
         {
            return;
         }
         this.openingToolPackage = true;
         NetHelper.sendRequest(§_-99§.§_-JC§,{
            "tId":_loc2_._cId,
            "number":1,
            "type":3,
            "openPackage":1
         },this.onToolPackageOpened,this.onToolPackageOpenFailed);
      }

      private function onToolPackageOpened(param1:§_-Ep§) : void
      {
         this.openingToolPackage = false;
         var _loc2_:Object = this.responseData(param1);
         if(_loc2_ == null || int(_loc2_["code"]) != 1)
         {
            this.showToolPackageMessage(_loc2_ != null && _loc2_["direction"] != null ? String(_loc2_["direction"]) : "礼包打开失败");
            return;
         }
         this.model.dirty = true;
         this.model.reload();
         this.showToolPackageMessage(String(_loc2_["direction"]));
      }

      private function onToolPackageOpenFailed(param1:§_-Ep§) : void
      {
         this.openingToolPackage = false;
         var _loc2_:Object = this.responseData(param1);
         this.showToolPackageMessage(_loc2_ != null && _loc2_["direction"] != null ? String(_loc2_["direction"]) : "礼包打开失败，请重试");
      }

      private function responseData(param1:§_-Ep§) : Object
      {
         if(param1 == null || param1.result == null)
         {
            return null;
         }
         var _loc2_:§_-P9§ = param1.result as §_-P9§;
         return _loc2_ == null ? null : _loc2_.m_extra;
      }

      private function showToolPackageMessage(param1:String) : void
      {
         this.openFloat(§_-Ac§.§_-Rf§,{
            "text":param1,
            "parent":this.module.app.farmView.stage
         });
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
