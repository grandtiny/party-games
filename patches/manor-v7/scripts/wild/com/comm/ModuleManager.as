package wild.com.comm
{
   import flash.events.EventDispatcher;
   import flash.events.IEventDispatcher;
   import wild.com.Shell.command.CmdAPI;
   
   public class ModuleManager extends EventDispatcher
   {
      
      private static var _npcList:Object;
      
      private static var _xml:XML;
      
      private static var _API:IBeastAPI;
      
      public function ModuleManager(param1:IEventDispatcher = null)
      {
         super(param1);
      }
      
      public static function loadModule(param1:XML) : void
      {
         var _loc8_:ModuleLoader = null;
         _API = CmdAPI.getInstance().api;
         var _loc2_:XML = param1;
         if(!_loc2_)
         {
            return;
         }
         var _loc3_:String = _loc2_.@start;
         var _loc4_:String = _loc2_.@end;
         var _loc5_:Number = Number(_loc3_);
         var _loc6_:Number = Number(_loc4_);
         var _loc7_:Number = _API.serverTime * 1000;
         if(_loc5_ < _loc7_ && _loc7_ < _loc6_)
         {
            _loc8_ = new ModuleLoader();
            _loc8_.addModule(_loc2_);
         }
      }
   }
}

import flash.display.Loader;
import flash.events.Event;
import flash.net.URLRequest;
import flash.system.ApplicationDomain;
import flash.system.LoaderContext;
import wild.com.Shell.command.CmdAPI;

class ModuleLoader
{
   
   private var _mainURL:String;
   
   private var _API:IBeastAPI;
   
   private var _cropsLoader:CropLoader;
   
   public function ModuleLoader()
   {
      super();
      this._API = CmdAPI.getInstance().api;
   }
   
   private function compFn(param1:Event) : void
   {
      var _loc3_:Object = null;
      var _loc4_:Loader = null;
      var _loc2_:Object = this._cropsLoader.contents;
      for each(_loc3_ in _loc2_)
      {
         if(_loc3_ is ApplicationDomain)
         {
            this._API.pushToMaterialLib(_loc3_ as ApplicationDomain);
         }
      }
      _loc4_ = new Loader();
      _loc4_.load(new URLRequest(this._mainURL));
   }
   
   public function addModule(param1:XML) : void
   {
      var _loc4_:String = null;
      var _loc6_:String = null;
      var _loc7_:LoaderContext = null;
      var _loc2_:Array = [];
      var _loc3_:XMLList = param1.material;
      for(_loc4_ in _loc3_)
      {
         _loc6_ = _loc3_[_loc4_].@url;
         _loc6_ = this._API.addPrefix(_loc6_);
         _loc2_.push(_loc6_);
      }
      if(_loc2_.length > 0)
      {
         this._cropsLoader = new CropLoader();
         _loc7_ = new LoaderContext();
         _loc7_.applicationDomain = this._API.appCurrentDomain;
         this._cropsLoader.lc = _loc7_;
         this._cropsLoader.addEventListener(Event.COMPLETE,this.compFn);
         this._cropsLoader.load(_loc2_,true);
      }
      var _loc5_:String = param1.@url;
      _loc5_ = this._API.addPrefix(_loc5_);
      this._mainURL = _loc5_;
   }
}
